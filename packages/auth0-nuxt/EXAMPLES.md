# Examples

- [Configuration](#configuration)
  - [Basic configuration](#basic-configuration)
  - [Configuring the mountes routes](#configuring-the-mountes-routes)
  - [Configuring Stateful Sessions](#configuring-stateful-sessions)
- [Protecting Routes](#protecting-routes)
- [Requesting an Access Token to call an API](#requesting-an-access-token-to-call-an-api)

## Configuration

### Basic configuration

To get started, you need to install the module and configure it in your `nuxt.config.ts`.

#### Install the dependency:
```bash
npm install @auth0/auth0-nuxt@beta
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
The SDK for Nuxt Web Applications mounts 4 main routes:

1. `/auth/login`: the login route that the user will be redirected to to initiate an authentication transaction.
2. `/auth/logout`: the logout route that must be added to your Auth0 application's Allowed Logout URLs
3. `/auth/callback`: the callback route that must be added to your Auth0 application's Allowed Callback URLs
4. `/auth/backchannel-logout`: the route that will receive a `logout_token` when a configured [Back-Channel Logout](https://auth0.com/docs/authenticate/login/logout/back-channel-logout) initiator occurs


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