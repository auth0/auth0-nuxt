# Nuxt Stateful Sessions Example

This example shows how to use a custom **server-side session store** with
[`@auth0/auth0-nuxt`](../../packages/auth0-nuxt).

By default the SDK stores the whole session, encrypted, in a cookie (stateless). Providing a
`sessionStoreFactoryPath` in the module options switches to a **stateful** session: the session data
(the authenticated user and tokens) is persisted server-side, and the cookie only carries an encrypted
reference to it. This example uses an in-memory `Map` (`server/utils/session-store.ts`). In production you would
use Redis or a database, so sessions survive restarts and are shared across instances.
The [`example-nuxt-web`](../example-nuxt-web) example shows a store backed by Redis through the
[Nitro storage layer](https://nitro.build/guide/storage).

## Install dependencies

From the root of the repository:

```bash
npm install
npm run build
```

## Configuration

Rename `.env.example` to `.env` and configure it:

```env
NUXT_AUTH0_DOMAIN=YOUR_AUTH0_DOMAIN
NUXT_AUTH0_CLIENT_ID=YOUR_AUTH0_CLIENT_ID
NUXT_AUTH0_CLIENT_SECRET=YOUR_AUTH0_CLIENT_SECRET
NUXT_AUTH0_SESSION_SECRET=YOUR_AUTH0_SESSION_SECRET
NUXT_AUTH0_APP_BASE_URL=http://localhost:3000
```

The `NUXT_AUTH0_SESSION_SECRET` is the key used to encrypt the session cookie. You can generate a secret using `openssl`:

```shell
openssl rand -hex 64
```

> [!IMPORTANT]
> In the Auth0 Dashboard, add `http://localhost:3000/auth/callback` to **Allowed Callback URLs** and
> `http://localhost:3000` to **Allowed Logout URLs**.

## Run

```bash
npm run start
```

The application has 3 routes:

- `/`: The home route, displaying a message depending on the authentication state.
- `/public`: A public route that can be accessed without authentication.
- `/private`: A private route that can only be accessed by authenticated users.

Visit http://localhost:3000 and log in. The session data lives in the in-memory store. Because the store is in memory,
sessions are lost when the server restarts. Swap in Redis or a database for durability.

## How it works

- `nuxt.config.ts` points `sessionStoreFactoryPath` to `server/utils/session-store.ts`.
- That file default exports a factory that returns a `SessionStore`: `get`, `set`, `delete` and `deleteByLogoutToken`.
  The SDK calls `deleteByLogoutToken` when Auth0 sends a Back-Channel Logout request to `/auth/backchannel-logout`.
