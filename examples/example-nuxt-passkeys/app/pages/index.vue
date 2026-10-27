<script setup lang="ts">
const user = useUser();
const {
  status,
  message,
  tone,
  verificationRequired,
  codes,
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
} = usePasskeyFlow();

useHead({ title: 'Passkeys with Auth0' });

const showSignup = ref(false);
const profile = reactive({ email: '', phoneNumber: '', name: '', deliveryMethod: 'text' as 'text' | 'voice' });
const working = computed(() => status.value === 'working');

function cancel() {
  showSignup.value = false;
  reset();
}
</script>

<template>
  <main class="card" :aria-busy="working">
    <h1>Passkeys with Auth0</h1>

    <!-- Logged in -->
    <section v-if="user" data-testid="profile">
      <p v-if="message" :class="['notice', tone]" role="status" data-testid="status">{{ message }}</p>
      <p>
        You are logged in as <strong data-testid="user">{{ user.email ?? user.name ?? user.sub }}</strong
        >.
      </p>
      <details>
        <summary>Claims</summary>
        <pre>{{ JSON.stringify(user, null, 2) }}</pre>
      </details>
      <p><a class="button secondary" href="/auth/logout" data-testid="logout">Log out</a></p>
    </section>

    <!-- Logged out -->
    <template v-else>
      <p v-if="!supported" class="notice error" data-testid="unsupported">
        This browser does not support passkeys, or the page is not served over HTTPS.
      </p>
      <p v-if="message" :class="['notice', tone]" role="status" data-testid="status">{{ message }}</p>
      <p v-if="mfaRequired">
        <a class="button" href="/auth/login" data-testid="mfa-login">Log in with Universal Login</a>
      </p>

      <!-- Rate limited: the same request can be sent again -->
      <div v-if="canRetry" class="actions">
        <button type="button" data-testid="retry" @click="retry">Try again</button>
        <button type="button" class="secondary" @click="cancel">Start over</button>
      </div>

      <!-- One-time codes -->
      <form v-else-if="status === 'codes'" data-testid="codes-form" @submit.prevent="submitCodes">
        <label v-for="identifier in verificationRequired" :key="identifier">
          {{ identifier === 'email' ? 'Email code' : 'Phone code' }}
          <input
            v-model="codes[identifier]"
            :name="identifier"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="10"
            :data-testid="`code-${identifier}`"
          />
        </label>
        <div class="actions">
          <button type="submit" data-testid="codes-submit">{{ canResend ? 'Create passkey' : 'Verify' }}</button>
          <button v-if="canResend" type="button" class="secondary" data-testid="resend" @click="resendCodes">
            Send new codes
          </button>
          <button type="button" class="secondary" @click="cancel">Cancel</button>
        </div>
      </form>

      <!-- Signup form -->
      <form v-else-if="showSignup && !working" data-testid="signup-form" @submit.prevent="signUp({ ...profile })">
        <label>
          Email
          <input v-model="profile.email" type="email" autocomplete="email" data-testid="signup-email" />
        </label>
        <label>
          Phone number (optional)
          <input
            v-model="profile.phoneNumber"
            type="tel"
            autocomplete="tel"
            placeholder="+14155550100"
            data-testid="signup-phone"
          />
        </label>
        <label v-if="profile.phoneNumber.trim()">
          The phone code arrives by
          <select v-model="profile.deliveryMethod" data-testid="signup-delivery">
            <option value="text">text message</option>
            <option value="voice">voice call</option>
          </select>
        </label>
        <label>
          Name (optional)
          <input v-model="profile.name" autocomplete="name" data-testid="signup-name" />
        </label>
        <div class="actions">
          <button type="submit" data-testid="signup-submit">Create account with a passkey</button>
          <button type="button" class="secondary" @click="cancel">Cancel</button>
        </div>
      </form>

      <!-- Start -->
      <div v-else-if="!working" class="actions">
        <button type="button" :disabled="!supported" data-testid="login" @click="logIn">Log in with a passkey</button>
        <button type="button" class="secondary" :disabled="!supported" data-testid="signup" @click="showSignup = true">
          Sign up with a passkey
        </button>
        <a href="/auth/login" data-testid="universal-login">Log in with Universal Login</a>
      </div>
    </template>
  </main>
</template>
