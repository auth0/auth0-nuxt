# Examples

- [Configuration](#configuration)
  - [Basic configuration](#basic-configuration)
  - [Configuring the mountes routes](#configuring-the-mountes-routes)
  - [Configuring Stateful Sessions](#configuring-stateful-sessions)
  - [Customizing State and Transaction Identifiers](#customizing-state-and-transaction-identifiers)
- [Protecting Routes](#protecting-routes)
- [Requesting an Access Token to call an API](#requesting-an-access-token-to-call-an-api)
- [Login and Signup using Passkeys](#login-and-signup-using-passkeys)
  - [How it works](#how-it-works)
  - [The routes](#the-routes)
  - [Handling errors and retries](#handling-errors-and-retries)
  - [Verifying the email address or phone number at signup](#verifying-the-email-address-or-phone-number-at-signup)
  - [The browser side](#the-browser-side)
  - [Securing the routes](#securing-the-routes)

## Configuration

### Basic configuration

To get started, you need to install the module and configure it in your `nuxt.config.ts`.

#### Install the dependency:
```bash
npm install @auth0/auth0-nuxt
```

#### Configure the module in `nuxt.config.ts`:

```js
{
  modules: ['@auth0/auth0-nuxt'],
  runtimeConfig: {
    auth0: {
      domain: '<AUTH0_DOMAIN>', // is overridden by NUXT_AUTH0_DOMAIN environment variable
      clientId: '<AUTH0_CLIENT_ID>', // is overridden by NUXT_AUTH0_CLIENT_ID environment variable
      clientSecret: '<AUTH0_CLIENT_SECRET>', // is overridden by NUXT_AUTH0_CLIENT_SECRET environment variable
      sessionSecret: '<SESSION_SECRET>', // is overridden by NUXT_AUTH0_SESSION_SECRET environment variable
      appBaseUrl: '<APP_BASE_URL>', // is overridden by NUXT_AUTH0_APP_BASE_URL environment variable
    },
  },
}
```

The `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and `AUTH0_CLIENT_SECRET` can be obtained from the Auth0 Dashboard once you've created an application. This application must be a Regular Web Application.

The `SESSION_SECRET` is the key used to encrypt the session cookie. You can generate a secret using openssl:

```bash
openssl rand -hex 64
```

The `APP_BASE_URL` is the URL that your application is running on. When developing locally, this is most commonly http://localhost:3000.

> [!IMPORTANT]
> You will need to register the following URLs in your Auth0 Application via the [Auth0 Dashboard](https://manage.auth0.com):
>
> - Add `http://localhost:3000/auth/callback` to the list of **Allowed Callback URLs**
> - Add `http://localhost:3000` to the list of **Allowed Logout URLs**

#### Using Environment Variables
Aleternatively, you can use environment variables to configure the module. If prefixed with `NUXT_AUTH0_`, the module will automatically pick them up and use them to configure the SDK.

```
NUXT_AUTH0_DOMAIN=<AUTH0_DOMAIN>
NUXT_AUTH0_CLIENT_ID=<AUTH0_CLIENT_ID>
NUXT_AUTH0_CLIENT_SECRET=<AUTH0_CLIENT_SECRET>
NUXT_AUTH0_APP_BASE_URL=http://localhost:3000
NUXT_AUTH0_SESSION_SECRET=<YOUR_LONG_RANDOM_SECRET>
```

### Configuring the mountes routes
The SDK for Nuxt Web Applications mounts 5 main routes:

1. `/auth/login`: the login route that the user will be redirected to to initiate an authentication transaction.
2. `/auth/logout`: the logout route that must be added to your Auth0 application's Allowed Logout URLs
3. `/auth/callback`: the callback route that must be added to your Auth0 application's Allowed Callback URLs
4. `/auth/backchannel-logout`: the route that will receive a `logout_token` when a configured [Back-Channel Logout](https://auth0.com/docs/authenticate/login/logout/back-channel-logout) initiator occurs
5. `/auth/profile`: returns the user's claims as JSON with `Cache-Control: no-store`


To disable this behavior, you can set the `mountRoutes` option to `false` when registering the module (it's true by default):

```ts
modules: [['@auth0/auth0-nuxt', { mountRoutes: false }]]
```

Alternatively, if you do not wish to disable the routes but change the endpoint paths used for mounting, you can specify the `routes` option:

```ts
modules: [['@auth0/auth0-nuxt', { 
  routes: { 
    login: '/custom-auth/login',
    logout: '/custom-auth/logout',
    callback: '/custom-auth/callback',
    backchannelLogout: '/custom-auth/backchannel-logout',
    profile: '/custom-auth/profile',
  }
}]]
```

### Configuring Stateful Sessions
By default, the SDK uses a stateless session, meaning that the session data is stored in the cookie. If you want to use a stateful session, and persist the session data to your persistence layer of choice, you can configure the SDK to use a session store by providing a `sessionStoreFactoryPath` in the module options.

```ts
export default defineNuxtConfig({
  modules: [
    [
      '@auth0/auth0-nuxt',
      {
        sessionStoreFactoryPath: '~/server/utils/session-store-factory.ts',
      },
    ],
  ],
});
```

Where `~/server/utils/session-store-factory.ts` is the path to your session store factory. The session store factory should `default export` a factory function that returns an instance implementing the `SessionStore` interface from the SDK.

```ts
import type { SessionStore, StateData, StoreOptions } from '@auth0/auth0-nuxt';
import type { Storage } from "unstorage";

export class MyRedisStore implements SessionStore {
  readonly #store: Storage<StateData>;

  constructor(store: Storage<StateData>) {
    this.#store = store;
  }
  async delete(identifier: string): Promise<void> {
    await this.#store.removeItem(identifier);
  }

  async set(identifier: string, stateData: StateData): Promise<void> {
    await this.#store.setItem(identifier, stateData);
  }

  async get(identifier: string): Promise<StateData | undefined> {
    const result = await this.#store.getItem<StateData>(identifier);

    // As redis returns null if the key does not exist, we need to map it to undefined
    return result ?? undefined;
  }

  async deleteByLogoutToken(claims: any, options?: StoreOptions): Promise<void> {
    // Implement your logic to delete by logout token
    // This is just a placeholder
    console.log('Deleting by logout token:', claims);
  }
}

export default function getSessionStoreInstance() {
  const storage = useStorage<StateData>('redis');
  return new MyRedisStore(storage);
}
```

As the above example relies on the [Nitro storage layer](https://nitro.build/guide/storage), make sure to configure the storage layer in your `nuxt.config.ts` accordingly:

```ts
export default defineNuxtConfig({
  nitro: {
    storage: {
      redis: {
        driver: 'redis',
        port: 6379,
        host: "127.0.0.1",
      }
    }
  },
});
```

### Customizing State and Transaction Identifiers

By default, the SDK uses predefined identifiers for storing state and transaction data in cookies during the authentication flow. If you need to customize these identifiers (for example, to avoid conflicts with other cookies or to meet specific naming requirements), you can configure them in your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    auth0: {
      domain: '<AUTH0_DOMAIN>',
      clientId: '<AUTH0_CLIENT_ID>',
      clientSecret: '<AUTH0_CLIENT_SECRET>',
      sessionSecret: '<SESSION_SECRET>',
      appBaseUrl: '<APP_BASE_URL>',
      stateIdentifier: 'my-custom-state',
      transactionIdentifier: 'my-custom-transaction',
    },
  },
});
```

These identifiers are used as keys for storing temporary authentication data in cookies. If not specified, the SDK will use its default identifiers.

## Protecting Routes

#### Route Middlware

In order to protect a Nuxt route, you can use the SDK's `useUser()` composable method in a custom route middleware. This will check if there is a user and redirect them to the login page if not:

```ts
// middleware/auth.ts
import { useUser } from '@auth0/auth0-nuxt';

export default defineNuxtRouteMiddleware((to, from) => {
  const session = useUser();

  if (!session.value) {
    return navigateTo(`/auth/login?returnTo=${to.path}`);
  }
});
```

> [!NOTE]  
> You can replace the check above with any check you want, such as checking for a specific user claim.

With that middleware in place, you can protect routes by adding it to the `middleware` property of the corresponding Nuxt route:

```html
<script setup>
definePageMeta({
  middleware: [ 'auth' ],
});
</script>
```

#### Server Middleware
Additionally, you can also use a server middleware to protect server-side rendered routes by using the `useAuth0` server-side composable. This middleware will check if the user is authenticated and redirect them to the login page if they are not:

```ts
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);

  if (url.pathname === '/private') {
    const auth0Client = useAuth0(event);
    const session = await auth0Client.getSession();
    if (!session) {
      return sendRedirect(event, `/auth/login?returnTo=${url.pathname}`);
    }
  }
});
```

> [!IMPORTANT]  
> The above examples are both to protect routes by the means of a session, and not API routes using a bearer token. 

## Controlling the SSR user write

`useUser()` is backed by `useState`, which Nuxt serializes into the `__NUXT__` payload of server-rendered HTML. If that HTML is served from a shared cache, one visitor's claims can be delivered to another.

**This SDK cannot detect how your responses are cached.** If you serve authenticated routes from a shared cache, you must opt those routes out yourself. **The default is `ssrUser: true`, so a cached authenticated route with no `ssrUser: false` rule leaks.**

Opt out per route with a route rule:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/blog/**': { swr: 3600, auth0: { ssrUser: false } },
  },
});
```

Or set the default for every route and opt individual routes back in:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  auth0: { ssrUser: false },
  routeRules: {
    '/account': { auth0: { ssrUser: true } },
  },
});
```

A route rule always wins over the module option. Opted-out routes render anonymous HTML and hydrate `useUser()` in the browser from `/auth/profile`, which is served `Cache-Control: no-store`.

> [!IMPORTANT]
> **Do not protect an opted-out route with route middleware that checks `useUser()`.** On an opted-out route there is deliberately no user during SSR, so such middleware sees an empty session even for a signed-in user and redirects to `/auth/login`; Auth0 returns them to the same route, which renders anonymous again, and the redirect loops. Use server middleware that reads the session from the H3 event instead. `ssrUser: false` removes the user from the rendered payload, not from the session.

Client hydration runs once at app init, not on every navigation: where SSR wrote the user the plugin is a no-op, and where it did not, the fetched user carries across later navigations.

If you set `mountRoutes: false`, mount the profile handler yourself, otherwise hydration has nothing to fetch and opted-out routes stay anonymous.

> [!WARNING]
> If you mount it at a path of your own, add a rule for that path:
>
> ```ts
> routeRules: { '/your/profile/path': { cache: false } }
> ```
>
> Nitro's handler cache is keyed by path without the session cookie, so a wildcard like `'/**': { swr: 60 }` would serve one user's claims to the next. The SDK already sets this for its own profile path.

## Requesting an Access Token to call an API

If you need to call an API on behalf of the user, you want to specify the `audience` parameter when registering the runtime configuration for the auth0 module. This will make the SDK request an access token for the specified audience when the user logs in.

```ts
runtimeConfig: {
  auth0: {
    domain: '<AUTH0_DOMAIN>', // is overridden by NUXT_AUTH0_DOMAIN environment variable
    clientId: '<AUTH0_CLIENT_ID>', // is overridden by NUXT_AUTH0_CLIENT_ID environment variable
    clientSecret: '<AUTH0_CLIENT_SECRET>', // is overridden by NUXT_AUTH0_CLIENT_SECRET environment variable
    sessionSecret: '<SESSION_SECRET>', // is overridden by NUXT_AUTH0_SESSION_SECRET environment variable
    appBaseUrl: '<APP_BASE_URL>', // is overridden by NUXT_AUTH0_APP_BASE_URL environment variable
    audience: '<AUTH0_AUDIENCE>', // is overridden by NUXT_AUTH0_AUDIENCE environment variable
  },
}
```
The `AUTH0_AUDIENCE` is the identifier of the API you want to call. You can find this in the API section of the Auth0 dashboard.

Retrieving the token can be achieved by using `getAccessToken` using the server-side composable `useAuth0`:

```ts
const auth0Client = useAuth0(event);
const accessTokenResult = await auth0Client.getAccessToken();
// You can now use `accessTokenResult.accessToken`
```

## Login and Signup using Passkeys

Passkeys let users sign up and log in with a device credential (a fingerprint, a face scan or a security key) instead of a password. A signup can also verify the user's email address and phone number with one-time codes before the account is created.

The module does not mount routes for this flow. You add three server routes that call `useAuth0(event).passkey`, so your own validation, rate limits and bot checks sit in front of them. After a successful flow the session is the same as after an OIDC login, so `useUser()`, `useAuth0(event).getSession()` and `getAccessToken()` work as usual. The [passkeys example app](https://github.com/auth0/auth0-nuxt/tree/main/examples/example-nuxt-passkeys) has these routes and a complete page for them.

> [!IMPORTANT]
> Check these in your [Auth0 Dashboard](https://manage.auth0.com) first:
>
> 1. **Enable the passkey authentication method**: go to **Authentication** > **Database** > your connection > **Authentication Methods** > **Passkey**. The connection's name is the `realm` of the routes below (the example reads it from `NUXT_PASSKEY_REALM`). Without a `realm`, Auth0 uses the tenant's Default Directory.
> 2. **Enable the passkey grant**: go to your application > **Advanced Settings** > **Grant Types** and enable **Passkey**. `passkey.complete()` fails without it.
> 3. **Set up a [custom domain](https://auth0.com/docs/customize/custom-domains)** and use it as `domain` in `runtimeConfig.auth0`. Passkeys are bound to it, so they do not work on the default `*.auth0.com` domain. The page that asks for the passkey must be served over HTTPS from your custom domain or one of its subdomains (usually a subdomain, because Auth0 serves the custom domain itself). `http://localhost` does not work: the browser refuses the passkey with a `SecurityError`. The example app's README shows [how to run it on your machine](https://github.com/auth0/auth0-nuxt/blob/main/examples/example-nuxt-passkeys/README.md#where-to-run-it).
> 4. **Use a client secret**: `startSignup()` and `startLogin()` accept only a `clientSecret` as their client credential, not a private key JWT or mTLS. This module is configured with a `clientSecret`, so set the application's authentication method to **Client Secret**.
>
> Read [the Auth0 docs](https://auth0.com/docs/authenticate/database-connections/passkeys) to learn more about passkeys.

### How it works

Every passkey flow takes two requests, because the WebAuthn calls (`navigator.credentials.create()` and `navigator.credentials.get()`) only run in the browser:

1. The browser asks your server to start. Your server calls `passkey.startSignup()` or `passkey.startLogin()` and returns `authnParamsPublicKey`, the options for the browser call.
2. The browser runs its call and sends the credential back. Your server calls `passkey.complete()`, which exchanges it for tokens and writes the session.

Between the two requests the SDK keeps the flow, including the Auth0 `authSession`, in the encrypted `HttpOnly` cookie `__a0_passkey_tx`, for as long as Auth0 allows the flow (the `timeout` it returns with the options: currently 60 seconds, or 15 minutes when the signup needs codes). The `authSession` never reaches your code or the browser, and a new start replaces the pending flow in that browser. Serve the page and these routes from the same origin, so that the browser sends the cookies back on its own.

With a [stateful session store](#stateful-sessions) nothing changes for these routes: `complete()` writes the session to your store, and the session cookie only holds an identifier.

> [!NOTE]
> `useAuth0(event).passkey` works in server routes and server middleware only. The SDK needs the `event` of the request to read and write its cookies.

### The routes

The routes are short because the checks live in four small files in `server/utils/`. Nitro auto-imports them, as it does for `useAuth0` and the passkey error classes (`PasskeyRegisterError`, `PasskeyChallengeError`, `PasskeyGetTokenError`, `MissingTransactionError`, `MissingRequiredArgumentError`, `SessionExpiredError` and `isMfaRequiredError`), so the routes need no imports. Copy the four files from the example app, and read [Securing the routes](#securing-the-routes) for what they do and what to change before you go live:

| File | What it holds |
| --- | --- |
| [`passkey-guard.ts`](https://github.com/auth0/auth0-nuxt/blob/main/examples/example-nuxt-passkeys/server/utils/passkey-guard.ts) | `guardPasskeyRequest()` (the `Origin` check, the rate limit and `Cache-Control: no-store`), `clientIp()` and `forwardedFor()` |
| [`passkey-input.ts`](https://github.com/auth0/auth0-nuxt/blob/main/examples/example-nuxt-passkeys/server/utils/passkey-input.ts) | `readSignupBody()` and `readCompleteBody()`: a bounded JSON read, and a copy of only the fields the routes pass on |
| [`passkey-failure.ts`](https://github.com/auth0/auth0-nuxt/blob/main/examples/example-nuxt-passkeys/server/utils/passkey-failure.ts) | `startFailure()` and `completeFailure()`: the table in [Handling errors and retries](#handling-errors-and-retries) as code |
| [`rate-limit.ts`](https://github.com/auth0/auth0-nuxt/blob/main/examples/example-nuxt-passkeys/server/utils/rate-limit.ts) | `rateLimit()` and `rateLimitKey()`: a small in-process limiter |

The files target the Node server preset, the default of `nuxt build`: `passkey-guard.ts` uses `node:net` and `passkey-input.ts` reads the Node request stream. On another runtime, adapt those two.

The files read two private settings. Add them to `nuxt.config.ts` next to `runtimeConfig.auth0`:

```ts
runtimeConfig: {
  passkey: {
    realm: '', // is overridden by NUXT_PASSKEY_REALM: the database connection. Empty means the Default Directory.
    clientIpHeader: '', // is overridden by NUXT_PASSKEY_CLIENT_IP_HEADER (see "Securing the routes")
  },
},
```

Then add the three routes:

**`server/api/passkey/signup/start.post.ts`**

```ts
export default defineEventHandler(async (event) => {
  try {
    guardPasskeyRequest(event, { name: 'signup-start', limit: 5 });
    const profile = await readSignupBody(event);
    const realm = useRuntimeConfig(event).passkey.realm || undefined;

    // 1a. Start a signup. When the connection verifies the email address or phone number, Auth0 sends the codes now.
    const { authnParamsPublicKey, verificationRequired } = await useAuth0(event).passkey.startSignup(
      { ...profile, realm },
      forwardedFor(event)
    );

    return { authnParamsPublicKey, verificationRequired: verificationRequired ?? [] };
  } catch (error) {
    return startFailure(event, error);
  }
});
```

**`server/api/passkey/login/start.post.ts`**

```ts
export default defineEventHandler(async (event) => {
  try {
    guardPasskeyRequest(event, { name: 'login-start', limit: 30 });
    const realm = useRuntimeConfig(event).passkey.realm || undefined;

    // 1b. Start a login.
    const { authnParamsPublicKey } = await useAuth0(event).passkey.startLogin({ realm }, forwardedFor(event));

    return { authnParamsPublicKey };
  } catch (error) {
    return startFailure(event, error);
  }
});
```

**`server/api/passkey/complete.post.ts`**

```ts
export default defineEventHandler(async (event) => {
  try {
    guardPasskeyRequest(event, { name: 'complete', limit: 30 });
    const { credential, verification } = await readCompleteBody(event);

    // 2. Complete a signup or a login. The SDK reads the flow from its cookie, exchanges the passkey for tokens and
    //    writes the session.
    await useAuth0(event).passkey.complete({ credential, verification }, forwardedFor(event));

    return { status: 'complete' };
  } catch (error) {
    return completeFailure(event, error);
  }
});
```

What the routes answer:

| Route | Success | Failure |
| --- | --- | --- |
| `POST /api/passkey/signup/start` | 200 with `authnParamsPublicKey` and `verificationRequired` (an empty list when no code is needed) | 400 `invalid` (bad input) or `error` (Auth0 refused), 403 `forbidden`, 413 and 415 `invalid`, 429 `rate_limited` |
| `POST /api/passkey/login/start` | 200 with `authnParamsPublicKey` | 400 `error`, 403 `forbidden`, 429 `rate_limited` |
| `POST /api/passkey/complete` | 200 `complete`, or 200 `mfa_required` | 400 `retry`, `invalid`, `session_expired`, `restart` or `failed`, 403 `forbidden`, 413 and 415 `invalid`, 429 `wait` (Auth0 limited the call) or `rate_limited` (this app's limit) |

The `status` values (`complete`, `retry`, `wait` and so on) are only a convention between these routes and the browser code below. Use whatever fits your frontend. The browser reads `status` from the body, and treats an answer without a known `status` (for example the generic 500 of Nitro) as `failed`.

`startSignup()` and `startLogin()` throw a `PasskeyRegisterError` or a `PasskeyChallengeError` when Auth0 refuses the request, for example because the user already exists, a code could not be sent, or Auth0 rate limits the call. Nothing is stored then. Nitro answers an error that nothing caught with the HTTP status of Auth0's answer (`error.statusCode`, for example 401 for a wrong client secret), so catch these errors as `startFailure()` does, and answer with your own status and message.

### Handling errors and retries

`passkey.complete()` deletes the stored flow once Auth0 has used the auth session: on success, on `mfa_required`, when Auth0 reports the auth session as used, expired or invalid, and when the ID token organization does not match. It also deletes the flow before it creates the session, so the flow is gone when that step fails: with a `SessionExpiredError`, or when your session store throws. After any other failure the flow is kept, and you can call `complete()` again with the same credential.

| `complete()` throws | Meaning | The route answers | What the browser does |
| --- | --- | --- | --- |
| `PasskeyGetTokenError` with `isRetryable` | A one-time code was wrong. `error.verificationRequired` lists the identifiers that still need a code (if it is missing, ask for the same ones again). | `retry` | Ask for those codes only, then send the same credential again. |
| `PasskeyGetTokenError` with `statusCode` 429 | Rate limited. Auth0 checks this before it uses the attempt. | `wait`, with `retryAfterSeconds` when Auth0 sent a `retry-after` header | Wait that long, then send the same request again. |
| `isMfaRequiredError(error)` | The passkey and any codes were accepted, but the user must complete MFA. No session yet. | `mfa_required` | The routes stop here. Never send `error.cause.mfa_token` to the browser. `useAuth0(event)` cannot continue an MFA flow yet, so send the user to OIDC login (the example links to `/auth/login`). |
| `SessionExpiredError` | The passkey was accepted, but the `session_expiry` claim of the ID token has already passed, so no session was created. The flow is gone. | `session_expired` | Tell the user, and send them to sign in again, for example with OIDC login. |
| `MissingTransactionError` | No flow to complete: none was started, it expired, a newer start replaced it (for example in another tab), or the cookie cannot be read (for example after the session secret changed). Auth0 was not called. | `restart` | Start a new flow. |
| `MissingRequiredArgumentError`, or `PasskeyGetTokenError` with `cause.error` set to `invalid_request` | The request was incomplete or invalid: the credential cannot be read, or a code is missing or blank. The SDK checks the credential and the codes before it calls Auth0, and the flow is kept. | `invalid` | Fix the input, then send again. |
| Any other `PasskeyGetTokenError` | Auth0 refused the exchange for another reason (see `error.cause?.error`, for example `invalid_grant` when the attempt expired or was already used), or could not be reached (the error has no `statusCode`). | `failed` | Send the same request once more. If that fails too, let the user try again with the same passkey. A flow that is over answers `restart` the second time: show the reason and start a new flow. |

The guard and the input checks answer before Auth0 is called: `forbidden` for a request from another site, `rate_limited` for a client over the limit, `invalid` for a body that is too large (413), not sent as JSON (415) or not valid (400). An error that is none of these (a bug, or your session store throwing) is thrown again, so that Nitro answers with its generic 500, which leaks nothing.

Use `isRetryable` to tell a wrong code from a failure that ends the attempt, and never the HTTP status or the error description: they are the same for both, because both are an `invalid_grant`. The errors never carry the `authSession`, but their `cause` can hold an `mfa_token`, so do not log or return a whole error.

`completeFailure()` is this table as code. `reply()` sets the status and the headers of the answer and returns its body, and `waitFor()` reads a positive `Retry-After`; both are in `passkey-failure.ts`, next to `startFailure()`.

```ts
export function completeFailure(event: H3Event, error: unknown): PasskeyBody {
  if (error instanceof PasskeyHttpError) {
    return reply(event, error.statusCode, error.body, error.headers);
  }
  if (isMfaRequiredError(error)) {
    // The passkey (and the codes) were accepted, but the user must also complete MFA, which `useAuth0` cannot continue
    // yet. This route stops here. Never send `error.cause.mfa_token` to the browser.
    return reply(event, 200, { status: 'mfa_required' });
  }
  if (error instanceof SessionExpiredError) {
    // The passkey was accepted, but the ID token says the session has already expired, so no session was created and
    // the SDK has already deleted the flow. The user signs in again.
    return reply(event, 400, { status: 'session_expired' });
  }
  if (error instanceof PasskeyGetTokenError && error.isRetryable) {
    // A wrong code. Ask again for the identifiers still listed, and send the same credential.
    return reply(event, 400, { status: 'retry', verificationRequired: error.verificationRequired ?? [] });
  }
  if (error instanceof PasskeyGetTokenError && error.statusCode === 429) {
    // Auth0 checks its rate limit before it uses the attempt, so the same request can be sent again later.
    const wait = waitFor(error);
    return reply(event, 429, { status: 'wait', ...wait }, retryAfterHeader(wait));
  }
  if (
    error instanceof MissingRequiredArgumentError ||
    (error instanceof PasskeyGetTokenError && error.cause?.error === 'invalid_request')
  ) {
    // An incomplete or invalid request, for example a missing code. The flow is still open.
    return reply(event, 400, { status: 'invalid', message: describeError(error) });
  }
  if (error instanceof MissingTransactionError) {
    // No flow to complete: none was started, it expired, or a newer start replaced it. Auth0 was not called.
    return reply(event, 400, { status: 'restart' });
  }
  if (error instanceof PasskeyGetTokenError) {
    // Usually the end of the attempt (too many wrong codes, the time ran out). After a server or network error the SDK
    // keeps the flow, so the browser sends the same request once more before it starts again.
    console.warn('passkey.complete() failed:', describeError(error));
    return reply(event, 400, { status: 'failed', message: describeError(error) });
  }
  throw error;
}
```

### Verifying the email address or phone number at signup

When the connection verifies identifiers at signup, `startSignup()` returns `verificationRequired` (for example `['email', 'phone']`) and Auth0 has sent a one-time code to each listed identifier. Ask the user for the codes **before** you call `navigator.credentials.create()`, so a user who never receives them is not left with a passkey for an account that was never created. Then send the codes with the credential. Auth0 checks the codes only when `complete()` runs, after the passkey exists, so a wrong code does not undo the passkey: send the same one again (see below). The profile field is `phoneNumber`, but its identifier and its code are `phone`:

```json
{ "credential": { "id": "...", "rawId": "...", "type": "public-key", "response": {} }, "verification": { "email": "123456", "phone": "654321" } }
```

- Send a code for every identifier in the list (a missing or blank one is answered with `invalid`).
- After a wrong code, ask again only for the identifiers in `error.verificationRequired`, and send the **same** credential, kept in page memory: the user sees no second passkey prompt. The SDK keeps the shorter list too.
- To send new codes, call the signup start route again before the passkey exists. That starts a new flow and sends new codes: the user enters the newest ones, and the passkey is created with the options from the latest response.
- The user has 15 minutes to enter the codes, retries included (Auth0's current `timeout` for a signup with codes). Any other passkey flow started in that browser, in any tab, replaces the pending signup, which can then no longer be completed.
- To choose how the phone code is delivered, pass `deliveryMethod` (`'text'` or `'voice'`) with the `phoneNumber`. Leave it out to let Auth0 use the channel the connection supports (SMS when it supports both or none). A channel that the connection does not support makes the start call fail.

Only the identifiers you pass are verified, using the connection's signup verification settings: an email address must be set up for verification with a one-time code (a verification link does not use this flow), and so must a phone number. See the [server SDK documentation](https://github.com/auth0/auth0-auth-js/blob/main/packages/auth0-server-js/EXAMPLES.md#verifying-the-email-or-phone-number-at-signup) for the details.

### The browser side

The WebAuthn calls are the same in every framework:

1. `POST` to the start route and read `authnParamsPublicKey`. For a signup with `verificationRequired`, ask the user for the codes now.
2. Turn the base64url fields of `authnParamsPublicKey` (`challenge`, `user.id` and the credential ids) into `ArrayBuffer`s, then call `navigator.credentials.create({ publicKey })` (signup) or `navigator.credentials.get({ publicKey })` (login). Where the browser has them, `PublicKeyCredential.parseCreationOptionsFromJSON()` and `parseRequestOptionsFromJSON()` do the conversion.
3. Turn the credential into base64url strings, and `POST` it, with the codes, to the complete route. On `retry`, ask for the listed codes and `POST` again with the same credential. On `restart`, start again.
4. On `complete` the session cookie is set. Read the user from the profile route of the module, so that `useUser()` and the page update without a reload.

The example app does all of this in the composable [`usePasskeyFlow()`](https://github.com/auth0/auth0-nuxt/blob/main/examples/example-nuxt-passkeys/app/composables/usePasskeyFlow.ts), which the page [`index.vue`](https://github.com/auth0/auth0-nuxt/blob/main/examples/example-nuxt-passkeys/app/pages/index.vue) uses. Its name leaves `usePasskey` free for a future composable of the SDK. This is the short version, to show the order of the calls:

```js
const user = useUser(); // call composables while the component sets up, not after an `await`

async function post(path, body = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { httpStatus: response.status, ...(await response.json()) };
}

// The session cookie is set. Read the user from the profile route of the module (`/auth/profile` unless you changed
// `routes.profile`), so that the page updates without a reload.
async function showUser() {
  user.value = await $fetch('/auth/profile');
}

async function loginWithPasskey() {
  const start = await post('/api/passkey/login/start');
  if (!start.authnParamsPublicKey) return start; // Auth0 refused the start: show start.message

  const publicKey = requestOptions(start.authnParamsPublicKey);
  const credential = await navigator.credentials.get({ publicKey });

  const result = await post('/api/passkey/complete', { credential: serialize(credential) });
  if (result.status === 'complete') await showUser();
  return result;
}

// `askForCodes(identifiers)` is your own UI. It resolves with one code for each identifier, for example
// { email: '123456', phone: '654321' }.
async function signUpWithPasskey(profile) {
  const start = await post('/api/passkey/signup/start', profile);
  if (!start.authnParamsPublicKey) return start; // for example the user already exists: show start.message

  // Ask for the codes first: the passkey is only created once the user has them.
  let identifiers = start.verificationRequired;
  let verification = identifiers.length > 0 ? await askForCodes(identifiers) : undefined;
  const publicKey = creationOptions(start.authnParamsPublicKey);
  const credential = serialize(await navigator.credentials.create({ publicKey }));

  let result = await post('/api/passkey/complete', { credential, verification });
  while (result.status === 'retry') {
    // A wrong code: ask again for the identifiers that are still listed, and send the same credential.
    if (result.verificationRequired.length > 0) identifiers = result.verificationRequired;
    verification = await askForCodes(identifiers);
    result = await post('/api/passkey/complete', { credential, verification });
  }

  if (result.status === 'complete') await showUser();
  return result; // result.status is 'complete', or one of the other statuses in the table above
}
```

This is the short version. The example app also handles a cancelled prompt, a network error, `wait`, `restart`, `failed` and a limit of five wrong codes. It is not tested in Safari or on iOS: WebAuthn needs a user gesture there, and the login and the signup without codes call it after a `fetch`.

The helpers `fromBase64url`, `toBase64url`, `creationOptions`, `requestOptions`, `serialize` and `webauthnMessage` are in [`app/utils/webauthn.ts`](https://github.com/auth0/auth0-nuxt/blob/main/examples/example-nuxt-passkeys/app/utils/webauthn.ts). Copy the file as it is: Nuxt auto-imports it from `app/utils` (`utils` in a Nuxt 3 app).

If `complete()` throws `MissingTransactionError` on every attempt, check that the browser decodes the base64url `challenge` to bytes, instead of using the characters of the string. Send only the fields that `serialize()` returns: Auth0 rejects the extra fields of `credential.toJSON()` with an `invalid_request` error.

### Securing the routes

These routes are open to anyone who can reach them, and the signup start route can make Auth0 send an email, an SMS or a voice call to any address or number. The example's four helper files do the following. Keep them, or do the same in your own way, before you go live:

- **Validate the body, and drop what you did not ask for.** `readSignupBody()` and `readCompleteBody()` copy only the fields the routes pass on, so the browser cannot choose the `realm`, the `organization`, `userMetadata`, the scopes or the audience, and Auth0 never receives a credential field it rejects. They accept only `application/json` of at most 32 KiB, also when the browser does not announce the length: a credential is a few KB. A client that keeps sending a far larger body can see its connection reset instead of the 413, so also set a body limit at your proxy. `startSignup()` also accepts a `username`: if your connection signs users up by username, add it to `readSignupBody()`.
- **Rate limit the routes**, the signup start route the strictest. Every signup start sends new codes, so a route that anyone can call can be used to send messages to any address or number. `guardPasskeyRequest()` counts the requests of each client per route and minute (5 for the signup start route, 30 for the other two) and answers 429 `rate_limited` with a `Retry-After` header above that. Do not rely only on Auth0's limits: also limit per email address or phone number, add a bot check (for example a CAPTCHA), and accept only the phone country codes you serve. A start call can also fail because the address already has an account (as a `PasskeyRegisterError`), so the signup route can be used to find out whether an address is registered: this is another reason to limit it. The limiter in `rate-limit.ts` counts in memory, in one process, and counts an IPv6 /64 as one client. With several instances, or serverless functions, also limit at your edge, or use a store with atomic counters, for example Redis.
- **Tell Auth0 the user's address, and trust the right header.** `forwardedFor()` sends the address of the user as `auth0-forwarded-for`. Auth0 uses it only for applications with **Trust Token Endpoint IP Header** turned on (**Advanced Settings** > **OAuth**). With it on, Auth0 answers a signup start whose value is not a valid IP address with a 400 error. By default `clientIp()` is the address of the connection: behind a proxy that is the proxy's address, so all users share one rate limit and Auth0 sees one address. If a proxy that you control sits in front of the app, set `runtimeConfig.passkey.clientIpHeader` (or `NUXT_PASSKEY_CLIENT_IP_HEADER`) to the name of the header it sets or appends to, for example `x-forwarded-for`. The app then uses the **last** entry of that header when it is a plain IP address: it is the address your proxy saw. An entry with a port (`203.0.113.9:51234`, which some proxies send) is not one, and the address of the connection is used instead. Never name a header that a client can send as it likes, and never use the first entry of `X-Forwarded-For`, because the client chooses it (`getRequestIP(event, { xForwardedFor: true })` of h3 returns it, so do not use that for limits). If several proxies append to `X-Forwarded-For`, name the header that your outermost trusted proxy sets instead (for example `cf-connecting-ip`).
- **Accept only requests from your own page.** The routes write cookies, so `guardPasskeyRequest()` refuses a `POST` whose `Origin` header is not the origin of `runtimeConfig.auth0.appBaseUrl` (403 `forbidden`). `fetch()` always sends `Origin` with a `POST`, and a page on another site cannot fake it. So `appBaseUrl` must be the address the browser uses, with its scheme and port.
- **Never cache the answers.** `guardPasskeyRequest()` sets `Cache-Control: no-store` before it does anything else, so no answer of these routes is cached, errors included.
- **Send one complete request at a time**, for example by disabling the submit button while a request is pending: parallel requests can use up the attempts Auth0 allows. The example also stops asking for codes after 5 wrong ones. That only spares the user: what limits a script is the rate limit above and Auth0's own limits.
- **Do not show Auth0's error text to visitors.** To help you while you test, the example answers a refused start with Auth0's description (`describeError()`), for example `user already exists`. That tells anyone whether an address has an account, and a wrong client secret shows as `Client authentication failed`. In a real app, answer with a generic message and log the details.
- **Never log the credential, the codes or a whole error.** `describeError()` returns a one-line summary instead: the description and the code of the Auth0 error, or for a server or network failure the message of its `cause`.

## Stateful Sessions

By default, the SDK uses a stateless session, meaning that the session data is stored in the cookie. If you want to use a stateful session, and persist the session data to your persistence layer of choice, you can configure the SDK to use a session store by providing a `sessionStoreFactoryPath` in the module options.

```ts
{
  modules: ['@auth0/auth0-nuxt'],
  auth0: {
    sessionStoreFactoryPath: '~/server/utils/session-store-factory.ts',
  },
}
```

Where `~/server/utils/session-store-factory.ts` is the path to your session store factory. The session store factory should `default export` a factory function that returns an instance implementing the `SessionStore` interface from the SDK.

Here's an example of a session store factory that uses Redis as the persistence layer, integrated through [the storage layer integrated in nuxt](https://nitro.build/guide/storage):

```ts
import type { SessionStore, StateData, StoreOptions } from '@auth0/auth0-nuxt';
import type { Storage } from "unstorage";

export class MyRedisStore implements SessionStore {
  readonly #store: Storage<StateData>;

  constructor(store: Storage<StateData>) {
    this.#store = store;
  }
  async delete(identifier: string): Promise<void> {
    this.#store.removeItem(identifier);
  }

  async set(identifier: string, stateData: StateData): Promise<void> {
    this.#store.setItem(identifier, stateData);
  }

  async get(identifier: string): Promise<StateData | undefined> {
    const result = await this.#store.getItem<StateData>(identifier);

    // As redis returns null if the key does not exist, we need to map it to undefined
    return result ?? undefined;
  }

  async deleteByLogoutToken(claims: any, options?: StoreOptions): Promise<void> {
    // Implement your logic to delete by logout token
    // This is just a placeholder
    console.log('Deleting by logout token:', claims);
  }
}

export default function getSessionStoreInstance() {
  const storage = useStorage<StateData>('redis');
  return new MyRedisStore(storage);
}
```
