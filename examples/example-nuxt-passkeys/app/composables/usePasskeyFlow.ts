import type {
  PasskeyCreationOptions,
  PasskeyCredentialResponse,
  PasskeyDeliveryMethod,
  PasskeyRequestOptions,
  PasskeyVerificationCodes,
  PasskeyVerificationIdentifier,
} from '@auth0/auth0-nuxt';
import { creationOptions, requestOptions, serialize, webauthnMessage } from '~/utils/webauthn';

// The browser half of the example. It never sees the Auth0 `authSession`: the SDK keeps it in the HttpOnly
// `__a0_passkey_tx` cookie. The page only gets the WebAuthn options and the identifiers to verify, and sends back the
// passkey and the one-time codes.

export type PasskeyFlowStatus = 'idle' | 'working' | 'codes' | 'done';
export type MessageTone = 'info' | 'success' | 'warn' | 'error';

/** What the signup form collects. */
export interface SignupProfile {
  email?: string;
  phoneNumber?: string;
  name?: string;
  deliveryMethod?: PasskeyDeliveryMethod;
}

/** What the routes answer (see server/utils/passkey-failure.ts), with the HTTP status. */
interface Answer {
  httpStatus: number;
  status?: string;
  message?: string;
  verificationRequired?: PasskeyVerificationIdentifier[];
  retryAfterSeconds?: number;
}

interface SignupStart {
  authnParamsPublicKey: PasskeyCreationOptions;
  verificationRequired: PasskeyVerificationIdentifier[];
}

interface CompleteBody {
  credential: PasskeyCredentialResponse;
  verification?: PasskeyVerificationCodes;
}

/** A signup between its steps: the options, the codes to collect, and the passkey once it exists. */
interface Signup {
  profile: SignupProfile;
  options: PasskeyCreationOptions;
  required: PasskeyVerificationIdentifier[];
  pending: PasskeyVerificationIdentifier[];
  credential?: PasskeyCredentialResponse;
  verification?: PasskeyVerificationCodes;
  wrongCodes: number;
}

/** Wrong codes per signup before the page gives up. Auth0 limits wrong codes too, but does not say how many are left. */
const MAX_WRONG_CODES = 5;

const FORBIDDEN =
  "This request must come from the app's own page. Open the page at the address in NUXT_AUTH0_APP_BASE_URL.";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** POSTs JSON and returns the answer, also for a 4xx or 5xx. What the routes did not answer counts as `failed`. */
async function post<T extends object = object>(path: string, body: object = {}): Promise<Answer & Partial<T>> {
  const answer = (value: Answer) => value as Answer & Partial<T>;
  try {
    const response = await $fetch.raw<unknown>(path, { method: 'POST', body, ignoreResponseError: true });
    const data: Record<string, unknown> = isRecord(response._data) ? response._data : {};
    if (typeof data.status !== 'string' && !data.authnParamsPublicKey) {
      // Not an answer of the routes, for example the generic 500 of Nitro or the error page of a proxy.
      return answer({
        httpStatus: response.status,
        status: 'failed',
        message: `The server answered HTTP ${response.status}.`,
      });
    }
    return { httpStatus: response.status, ...data } as unknown as Answer & Partial<T>;
  } catch {
    return answer({ httpStatus: 0, status: 'failed', message: 'The server did not answer.' });
  }
}

/** The profile as the start route wants it: trimmed, without empty fields, and a delivery method only with a phone. */
function tidy(profile: SignupProfile): SignupProfile {
  const value = (text?: string) => text?.trim() || undefined;
  const phoneNumber = value(profile.phoneNumber);
  return {
    email: value(profile.email),
    phoneNumber,
    name: value(profile.name),
    deliveryMethod: phoneNumber ? profile.deliveryMethod : undefined,
  };
}

const explain = (answer: Answer, fallback: string) =>
  answer.status === 'forbidden' ? FORBIDDEN : (answer.message ?? fallback);

/** "Lead: detail. Next step." for an error message. */
const sentence = (lead: string, detail?: string, next = 'Start again.') =>
  `${lead}${detail ? `: ${detail.replace(/\.?$/, '.')}` : '.'} ${next}`;

export function usePasskeyFlow() {
  const user = useUser();
  const { routes } = useRuntimeConfig().public.auth0 as { routes: { profile: string } };

  const status = ref<PasskeyFlowStatus>('idle');
  const message = ref('');
  const tone = ref<MessageTone>('info');
  /** The identifiers that need a code now (status `codes`). */
  const verificationRequired = ref<PasskeyVerificationIdentifier[]>([]);
  /** The codes the user types. The page binds its inputs to this object. */
  const codes = reactive<PasskeyVerificationCodes>({});
  /** The seconds a server asked us to wait, when it said so. */
  const retryAfterSeconds = ref<number>();
  /** A request waits to be sent again: the app or Auth0 rate limited it. */
  const canRetry = ref(false);
  /** The signup can still ask for new codes: the passkey does not exist yet. */
  const canResend = ref(false);
  /** The passkey was accepted, but this user must also complete MFA. */
  const mfaRequired = ref(false);
  /** False in a browser without WebAuthn. */
  const supported = ref(true);
  onMounted(() => {
    supported.value = typeof window.PublicKeyCredential === 'function';
  });

  let signup: Signup | undefined;
  let again: (() => Promise<void>) | undefined;
  let running = false;

  function say(text: string, kind: MessageTone = 'info') {
    message.value = text;
    tone.value = kind;
  }

  function clearCodes() {
    for (const identifier of Object.keys(codes) as PasskeyVerificationIdentifier[]) {
      delete codes[identifier];
    }
  }

  /** Back to the start, with a message. The signup form keeps what the user typed. */
  function fail(text: string, kind: MessageTone = 'error') {
    status.value = 'idle';
    verificationRequired.value = [];
    canResend.value = false;
    say(text, kind);
  }

  function working(text: string) {
    status.value = 'working';
    canRetry.value = false;
    retryAfterSeconds.value = undefined;
    mfaRequired.value = false;
    say(text);
  }

  /** One action at a time: parallel requests could use up the attempts Auth0 allows. */
  async function run(action: () => Promise<void>) {
    if (running) return;
    running = true;
    try {
      await action();
    } catch (error) {
      // Nothing above should throw. This keeps the page usable if it does.
      console.error(error);
      fail(`Something went wrong: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
    }
  }

  /** Shows a message and keeps the request: the user can send the same one again, or start over. */
  function offerRetry(text: string, resend: () => Promise<void>, seconds?: number) {
    again = resend;
    canRetry.value = true;
    retryAfterSeconds.value = seconds;
    status.value = 'idle';
    say(text, 'warn');
  }

  /** The wait: Auth0 or this app refused the request before it used the attempt. */
  function waitThen(answer: Answer, resend: () => Promise<void>) {
    const who = answer.status === 'wait' ? 'Auth0 is rate limiting these requests.' : 'Too many requests.';
    const when = answer.retryAfterSeconds
      ? `Try again in ${answer.retryAfterSeconds} seconds.`
      : 'Wait a moment, then try again.';
    offerRetry(`${who} ${when}`, resend, answer.retryAfterSeconds);
  }

  /** Shows one code input for each identifier in the list. The others were accepted. */
  function askForCodes(identifiers: PasskeyVerificationIdentifier[], error?: string) {
    if (!signup) return;
    signup.pending = identifiers;
    verificationRequired.value = identifiers;
    canResend.value = !signup.credential;
    status.value = 'codes';
    if (error) {
      say(error, 'error');
      return;
    }
    const many = identifiers.length > 1;
    say(
      signup.credential
        ? `Your passkey is ready. Enter the ${many ? 'codes' : 'code'} to finish.`
        : `Auth0 sent ${many ? 'one-time codes' : 'a one-time code'}. Enter ${many ? 'them' : 'it'} to create your passkey.`
    );
  }

  // ─── Passkey login ─────────────────────────────────────────────────────────

  async function logIn() {
    await run(async () => {
      working('Starting the passkey login...');
      const start = await post<{ authnParamsPublicKey: PasskeyRequestOptions }>('/api/passkey/login/start');
      if (!start.authnParamsPublicKey) {
        if (start.status === 'rate_limited') return waitThen(start, logIn);
        return fail(explain(start, 'The login could not start.'));
      }

      working('Choose a passkey in the browser prompt...');
      let credential: PasskeyCredentialResponse;
      try {
        const result = await navigator.credentials.get({ publicKey: requestOptions(start.authnParamsPublicKey) });
        if (!result) throw new Error('The browser returned no passkey.');
        credential = serialize(result as PublicKeyCredential);
      } catch (error) {
        return fail(webauthnMessage(error));
      }

      working('Logging you in...');
      await finish('login', { credential });
    });
  }

  // ─── Passkey signup ────────────────────────────────────────────────────────

  async function signUp(input: SignupProfile) {
    await run(async () => {
      const profile = tidy(input);
      if (!profile.email && !profile.phoneNumber) return fail('Enter an email address or a phone number.');

      working('Starting the signup...');
      const start = await post<SignupStart>('/api/passkey/signup/start', profile);
      if (!start.authnParamsPublicKey) {
        if (start.status === 'rate_limited') return waitThen(start, () => signUp(input));
        return fail(explain(start, 'The signup could not start.'));
      }

      clearCodes();
      signup = {
        profile,
        options: start.authnParamsPublicKey,
        required: start.verificationRequired ?? [],
        pending: [],
        wrongCodes: 0,
      };
      // Ask for the codes first: the passkey is only created once the user has them, so a user who never gets the
      // codes ends up with no passkey. A wrong code is only found out when the passkey is sent, so the page keeps that
      // passkey and sends it again with the new codes.
      if (signup.required.length > 0) return askForCodes(signup.required);
      await createPasskeyAndFinish();
    });
  }

  async function submitCodes() {
    await run(async () => {
      if (!signup) return fail('Start the signup again.');
      const verification: PasskeyVerificationCodes = {};
      for (const identifier of signup.pending) {
        const code = codes[identifier]?.trim();
        if (!code) return askForCodes(signup.pending, `Enter the ${identifier} code.`);
        verification[identifier] = code;
      }
      signup.verification = verification;
      if (!signup.credential) return createPasskeyAndFinish();

      working('Checking the code...');
      await finish('signup', { credential: signup.credential, verification });
    });
  }

  async function createPasskeyAndFinish() {
    if (!signup) return;
    working('Create the passkey in the browser prompt...');
    let credential: PasskeyCredentialResponse;
    try {
      const created = await navigator.credentials.create({ publicKey: creationOptions(signup.options) });
      if (!created) throw new Error('The browser returned no passkey.');
      credential = serialize(created as PublicKeyCredential);
    } catch (error) {
      // The flow is still open, and the inputs still hold what the user typed: they can try again.
      const text = webauthnMessage(error);
      if (signup.required.length === 0) return fail(text);
      return askForCodes(signup.pending.length > 0 ? signup.pending : signup.required, text);
    }
    // The passkey is created once. After a wrong code only the codes are asked again, and this credential is sent again.
    signup.credential = credential;

    working('Creating your account...');
    await finish('signup', { credential, verification: signup.verification });
  }

  /** Starts the signup again to send new codes. It is a new flow with its own codes: the user enters the newest ones. */
  async function resendCodes() {
    await run(async () => {
      const current = signup;
      if (!current || current.credential) return;

      working('Sending new codes...');
      const start = await post<SignupStart>('/api/passkey/signup/start', current.profile);
      if (!start.authnParamsPublicKey) {
        // Nothing was stored, so the codes that were already sent still work.
        if (start.status === 'rate_limited') return waitThen(start, resendCodes);
        return askForCodes(current.pending, explain(start, 'New codes could not be sent.'));
      }

      // A new flow: the passkey has to use the new options.
      current.options = start.authnParamsPublicKey;
      current.required = start.verificationRequired ?? [];
      current.wrongCodes = 0;
      clearCodes();
      if (current.required.length === 0) return createPasskeyAndFinish();
      askForCodes(current.required);
      say('New codes sent. Enter the newest ones.');
    });
  }

  // ─── Finishing a flow ──────────────────────────────────────────────────────

  /** Sends the passkey (and the codes) to the server and acts on the status it answers. */
  async function finish(flow: 'login' | 'signup', body: CompleteBody) {
    /** The same request again, for the "Try again" button. */
    const sendAgain = () =>
      run(async () => {
        working('Trying again...');
        await finish(flow, body);
      });

    let answer = await post('/api/passkey/complete', body);
    let over = false;
    if (answer.status === 'failed') {
      // After a server or network error the flow is still open: send the same request once more.
      const first = answer;
      answer = await post('/api/passkey/complete', body);
      // The first failure had ended the flow (for example Auth0 refused the passkey), so show its reason.
      if (answer.status === 'restart') {
        answer = first;
        over = true;
      }
    }

    switch (answer.status) {
      case 'complete':
        try {
          // The session cookie is set. Read the claims from the profile route, so the page updates without a reload.
          const claims = await $fetch<typeof user.value | null>(routes.profile, {
            headers: { accept: 'application/json' },
          });
          if (!claims) throw new Error('No session');
          user.value = claims;
        } catch {
          return fail('You are logged in, but the profile could not be loaded. Reload the page.', 'warn');
        }
        signup = undefined;
        status.value = 'done';
        verificationRequired.value = [];
        canResend.value = false;
        return say(
          flow === 'signup' ? 'Your account and passkey are ready.' : 'You are logged in with your passkey.',
          'success'
        );
      case 'retry': {
        // A wrong code: ask again for the identifiers still listed, and send the same passkey.
        if (flow !== 'signup' || !signup) return fail('The passkey could not be used. Start again.');
        const pending = answer.verificationRequired?.length ? answer.verificationRequired : signup.pending;
        if (++signup.wrongCodes >= MAX_WRONG_CODES) return fail('Too many wrong codes. Start the signup again.');
        clearCodes();
        return askForCodes(
          pending,
          pending.length > 1 ? 'A code was wrong. Enter the codes again.' : 'That code was wrong. Try again.'
        );
      }
      case 'wait':
      case 'rate_limited':
        // Auth0 (wait) or this app (rate_limited) refused the request before it used the attempt: the flow is still
        // open, and the same request can be sent again.
        return waitThen(answer, sendAgain);
      case 'mfa_required':
        mfaRequired.value = true;
        return fail(
          'Auth0 accepted the passkey, but this user must also complete MFA, which this example does not include. ' +
            'Use Universal Login instead.',
          'warn'
        );
      case 'session_expired':
        return fail(
          'Auth0 accepted the passkey, but the session had already expired, so you are not logged in. ' +
            'Use Universal Login to sign in again.',
          'warn'
        );
      case 'restart':
        return fail(
          `This ${flow} is over: it expired, or a newer passkey flow started in another tab. Start again.`,
          'warn'
        );
      case 'invalid':
        return fail(sentence('The request was refused', answer.message));
      case 'forbidden':
        return fail(FORBIDDEN);
      default:
        if (answer.status === 'failed' && !over) {
          // Twice in a row, and the flow is not over: a server or network failure keeps it, so the passkey is still good.
          // Offer the same request again instead of making a second passkey.
          return offerRetry(
            sentence('The passkey could not be used', answer.message, 'Try again, or start over.'),
            sendAgain
          );
        }
        return fail(sentence('The passkey could not be used', answer.message));
    }
  }

  /** Sends the request that was waiting for a rate limit again. */
  async function retry() {
    const resend = again;
    if (!resend) return;
    again = undefined;
    canRetry.value = false;
    await resend();
  }

  function reset() {
    signup = undefined;
    again = undefined;
    clearCodes();
    status.value = 'idle';
    verificationRequired.value = [];
    retryAfterSeconds.value = undefined;
    canRetry.value = false;
    canResend.value = false;
    mfaRequired.value = false;
    say('');
  }

  return {
    status,
    message,
    tone,
    verificationRequired,
    codes,
    retryAfterSeconds,
    canRetry,
    canResend,
    mfaRequired,
    supported,
    signUp,
    logIn,
    submitCodes,
    resendCodes,
    retry,
    reset,
  };
}
