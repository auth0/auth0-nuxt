# Nuxt Dynamic App Base URL Example

This example demonstrates the allow-list mode of the dynamic `appBaseUrl` feature in `@auth0/auth0-nuxt`.

A single Nuxt app serves two distinct domains — `app1.localhost` and `app2.localhost` — on port 3000 using the same Auth0 application. Instead of a single static `appBaseUrl`, the SDK is configured with an allow-list of origins. On each request it matches the incoming origin against the allow-list and uses the correct base URL for the callback `redirect_uri`, post-login redirect, and logout.

## Install dependencies

Install the dependencies using npm:

```bash
npm install
```

## Add `/etc/hosts` entries

So that both hostnames resolve to your machine, add the following to `/etc/hosts`:

```
127.0.0.1  app1.localhost
127.0.0.1  app2.localhost
```

(Many systems already resolve `*.localhost` to `127.0.0.1`, in which case this step can be skipped.)

## Configuration

Rename `.env.example` to `.env` and fill in your Auth0 credentials:

```ts
NUXT_AUTH0_DOMAIN=YOUR_AUTH0_DOMAIN
NUXT_AUTH0_CLIENT_ID=YOUR_AUTH0_CLIENT_ID
NUXT_AUTH0_CLIENT_SECRET=YOUR_AUTH0_CLIENT_SECRET
NUXT_AUTH0_SESSION_SECRET=YOUR_AUTH0_SESSION_SECRET
NUXT_AUTH0_APP_BASE_URL=http://app1.localhost:3000,http://app2.localhost:3000
```

The `NUXT_AUTH0_SESSION_SECRET` is the key used to encrypt the session cookie. You can generate a secret using `openssl`:

```shell
openssl rand -hex 64
```

`NUXT_AUTH0_APP_BASE_URL` is a **comma-separated allow-list** of the origins this app serves. The SDK parses this into an array and validates each request's origin against it.

## Configure your Auth0 tenant

Because the app serves two origins, both must be registered in your Auth0 application settings:

- **Allowed Callback URLs:** `http://app1.localhost:3000/auth/callback, http://app2.localhost:3000/auth/callback`
- **Allowed Logout URLs:** `http://app1.localhost:3000, http://app2.localhost:3000`
- **Allowed Web Origins:** `http://app1.localhost:3000, http://app2.localhost:3000`

## Run the app

```bash
npm run start
```

The application has 3 routes:

- `/`: The home route, displaying a message depending on the authentication state.
- `/public`: A public route that can be accessed without authentication.
- `/private`: A private route that can only be accessed by authenticated users. Navigating here while unauthenticated redirects to Auth0 and back.

## Test the dynamic base URL

Open each origin in your browser and walk through login/logout on each:

- http://app1.localhost:3000
- http://app2.localhost:3000

When you log in from `app1.localhost`, the SDK infers that origin, matches it against the allow-list, and uses `http://app1.localhost:3000/auth/callback` as the `redirect_uri`. The same flow on `app2.localhost` uses `http://app2.localhost:3000/auth/callback` — same configuration, correct URL per request. The current host is displayed in a banner at the top of each page so you can confirm which origin you are on.

If a request arrives from an origin that is not in the allow-list, the SDK throws an `InvalidConfigurationError`.
