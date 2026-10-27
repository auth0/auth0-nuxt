# Nuxt Web App with Passkeys Example

This example shows how to use [`@auth0/auth0-nuxt`](../../packages/auth0-nuxt) to sign users up and log them in with passkeys, next to the usual OIDC login:

- **Passkey Signup**, with a one-time code for the email address and/or phone number when the connection verifies them.
- **Passkey Login**.
- **OIDC Login** (`/auth/login`), mounted by the module as usual. Both kinds of login end in the same session.

The module does not mount any passkey routes. This app adds three in [`server/api/passkey`](./server/api/passkey), and the page in [`app/pages/index.vue`](./app/pages/index.vue) calls them through [`usePasskeyFlow()`](./app/composables/usePasskeyFlow.ts). The [passkeys section of EXAMPLES.md](../../packages/auth0-nuxt/EXAMPLES.md#login-and-signup-using-passkeys) explains each step.

## Before you start

You need an Auth0 tenant with:

1. **A [custom domain](https://auth0.com/docs/customize/custom-domains).** Passkeys are bound to it and do not work on `*.auth0.com`. Use it as `NUXT_AUTH0_DOMAIN`.
2. **A Regular Web Application** with:
   - the **Client Secret** authentication method (starting a passkey flow does not accept a private key JWT or mTLS),
   - the **Passkey** grant turned on, under **Advanced Settings** > **Grant Types**,
   - `<APP_BASE_URL>/auth/callback` in **Allowed Callback URLs** and `<APP_BASE_URL>` in **Allowed Logout URLs** (for the OIDC login),
   - optionally **Trust Token Endpoint IP Header** turned on, under **Advanced Settings** > **OAuth**, so that Auth0 uses the user's IP address that this app forwards.
3. **A database connection with the Passkey authentication method**, under **Authentication Methods**, enabled for the application. Set `NUXT_PASSKEY_REALM` to its name, or make it the tenant's Default Directory. To see the code inputs, turn on signup verification of the email address (with a code, not a link) and/or the phone number on the connection.
4. **A hostname for this app under your custom domain**, served over HTTPS. See [Where to run it](#where-to-run-it).

## Install dependencies

From the repository root:

```bash
npm install
npm run build
```

## Configuration

Rename `.env.example` to `.env` here and fill in the values:

| Variable | Value |
| --- | --- |
| `NUXT_AUTH0_DOMAIN` | Your custom domain, for example `login.example.com`. |
| `NUXT_AUTH0_CLIENT_ID`, `NUXT_AUTH0_CLIENT_SECRET` | From the application. |
| `NUXT_AUTH0_SESSION_SECRET` | The key that encrypts the session and passkey cookies. Generate one with `openssl rand -hex 64`. |
| `NUXT_AUTH0_APP_BASE_URL` | The full address of this app, with its scheme, for example `https://app.login.example.com`. Passkeys need `https://` (see [Where to run it](#where-to-run-it)). The page must be opened at exactly this address: the routes refuse a request whose `Origin` is another. |
| `NUXT_PASSKEY_REALM` | The connection with the Passkey method. Optional: the Default Directory is used when it is empty. |
| `NUXT_PASSKEY_CLIENT_IP_HEADER` | The name of a header that **a proxy you control** sets or appends to with the user's IP address, for example `x-forwarded-for`. The app uses the last entry of it, when that is a plain IP address (an entry with a port, like `203.0.113.9:51234`, is not). Leave it empty only when no proxy is in front of the app: the app then uses the address of the connection, which behind a proxy is the proxy's address for every user, so all users share one rate limit. Never name a header that a client can send as it likes (see below). |
| `NUXT_AUTH0_AUDIENCE` | Optional. The API to request an access token for. |

The IP address matters twice: the rate limits count by it, and the app tells Auth0 about it (`auth0-forwarded-for`). A header that the client can choose would let anyone pick their own address. If several proxies append to `X-Forwarded-For`, name the header that your outermost trusted proxy sets instead (for example `cf-connecting-ip` behind Cloudflare). The rate limit counts in this process only: with several instances, also limit at your edge, or use a shared store.

## Where to run it

Auth0 uses your custom domain as the WebAuthn relying party ID, and a browser only lets a page use a passkey when the page is served over HTTPS from that domain or one of its subdomains. For the custom domain `login.example.com`, use a subdomain such as `https://app.login.example.com`. Auth0 serves the custom domain itself, so the app cannot be there. `http://localhost:3000` does not work: the browser refuses the passkey with a `SecurityError`.

To run it on your machine, with the hostname `app.login.example.com` (use a subdomain of your own custom domain):

1. Point the hostname at `127.0.0.1` with a `hosts` file entry: `127.0.0.1 app.login.example.com`.
2. Make a locally trusted certificate with [mkcert](https://github.com/FiloSottile/mkcert): run `mkcert -install` once, then `mkcert app.login.example.com`. It writes `app.login.example.com.pem` and `app.login.example.com-key.pem`.
3. Put a reverse proxy in front of the app. Any proxy works. With [Caddy](https://caddyserver.com), save this as `Caddyfile` next to the two certificate files, and start it with `caddy run`. It serves `https://app.login.example.com:8443` and forwards to the app on port 3000:

   ```
   {
     auto_https disable_redirects
   }

   app.login.example.com:8443 {
     bind 127.0.0.1
     tls app.login.example.com.pem app.login.example.com-key.pem
     reverse_proxy localhost:3000
   }
   ```

4. In `.env`, set `NUXT_AUTH0_APP_BASE_URL=https://app.login.example.com:8443` (the port is part of the address) and `NUXT_PASSKEY_CLIENT_IP_HEADER=x-forwarded-for`. Caddy replaces the `X-Forwarded-For` header that a client sends, so the last entry is the address Caddy saw.

## Run

```bash
# in examples/example-nuxt-passkeys
npm start
```

Open `NUXT_AUTH0_APP_BASE_URL` in your browser. The example targets the Node server (`nuxt dev`, `nuxt build` with the default preset): the routes read the request stream of Node.

## What to try

1. **Passkey Signup** with an email address. If the connection verifies emails, enter the code from the email, then create the passkey in the browser prompt.
2. **Passkey Signup** with an email address and a phone number. Enter a wrong phone code: only the phone input comes back, and the passkey prompt does not appear again. Then enter the right code.
3. **Send new codes** before the passkey is created, then enter the newest codes.
4. **Passkey Login** with the passkey you created. Log out and log in again.
5. Start a signup, then a passkey login in another tab. Finishing the signup asks you to start again, because the newer flow replaced it.

## How it works

| File | What it does |
| --- | --- |
| [`server/api/passkey/signup/start.post.ts`](./server/api/passkey/signup/start.post.ts), [`login/start.post.ts`](./server/api/passkey/login/start.post.ts), [`complete.post.ts`](./server/api/passkey/complete.post.ts) | The three routes. Each one guards the request, reads the body, calls `useAuth0(event).passkey`, and maps an error to the status the page acts on. |
| [`server/utils/passkey-guard.ts`](./server/utils/passkey-guard.ts) | The `Origin` check, the rate limit, `Cache-Control: no-store`, and the client IP address. |
| [`server/utils/passkey-input.ts`](./server/utils/passkey-input.ts) | Reads the JSON body (at most 32 KiB) and copies only the fields the routes pass on. |
| [`server/utils/passkey-failure.ts`](./server/utils/passkey-failure.ts) | `startFailure()` and `completeFailure()`: the table of errors and statuses. |
| [`server/utils/rate-limit.ts`](./server/utils/rate-limit.ts) | A small in-process rate limiter. |
| [`app/utils/webauthn.ts`](./app/utils/webauthn.ts) | The WebAuthn helpers: base64url decoding of the options, and serializing the credential. |
| [`app/composables/usePasskeyFlow.ts`](./app/composables/usePasskeyFlow.ts) | The browser flow: the codes before the passkey, every status of `complete`. |
| [`app/pages/index.vue`](./app/pages/index.vue) | The page. |

The browser never sees the Auth0 `authSession`. The SDK keeps it in the encrypted `HttpOnly` cookie `__a0_passkey_tx` between the start and the complete request.

> [!NOTE]
> This example shows Auth0's error messages on the page to help you while testing. In a real app, show a generic message and log the details.

## Troubleshooting

| What you see | Why, and what to do |
| --- | --- |
| The server stops with `Auth0 configuration error` | Copy `.env.example` to `.env` and fill in the values. |
| `This request must come from the app's own page` | The page was not opened at `NUXT_AUTH0_APP_BASE_URL`. Use that exact address (scheme, host and port). |
| `The browser refused the passkey: the page origin does not fit its RP ID` | The page is not served over HTTPS from your custom domain or one of its subdomains. See [Where to run it](#where-to-run-it). |
| This browser does not support passkeys | The page is not in a secure context (HTTPS), or the browser has no WebAuthn. |
| The signup or login does not start, with a message from Auth0 | Check that the connection has the Passkey method turned on and is enabled for the application, that `NUXT_PASSKEY_REALM` is its name (or it is the Default Directory), that `NUXT_AUTH0_DOMAIN` is the custom domain, and that the application uses the Client Secret method. |
| The passkey prompt works, but finishing fails with a message from Auth0 | Turn on the **Passkey** grant for the application. |
| `This signup is over` or `This login is over` | The flow expired (Auth0 currently allows 60 seconds, or 15 minutes when codes are needed), or a newer passkey flow started in another tab. Start again. |
| `Auth0 is rate limiting these requests` | Wait as told, then use **Try again**. |
| `Too many requests` | This app's own rate limit (per IP address and minute: 5 signup starts, 30 login starts, 30 completions). Wait as told, then use **Try again**. The flow is kept. If every user sees it, the app sees one address for all of them: behind a proxy, set `NUXT_PASSKEY_CLIENT_IP_HEADER`. |
| `The passkey could not be used` with **Try again** | A server or network error stopped the request twice. The passkey is kept: use **Try again**, or **Start over**. |
| An `MFA` message after the passkey was accepted | The user must complete MFA, which this example does not include. Use Universal Login. |

## Tests

The tests live in the package and run from the repository root:

```bash
npm test -w @auth0/auth0-nuxt
```

They run this example's own routes and page against a fake Auth0 (no tenant needed): every status of `complete`, the guard, the input checks, the rate limits and the IP forwarding over HTTP, and the full signup and login in Chromium with a virtual authenticator. A test also checks the code in the passkeys section of EXAMPLES.md against the files of this example.
