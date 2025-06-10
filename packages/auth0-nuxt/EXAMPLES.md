# Examples

- [Configuration](#configuration)
  - [Basic configuration](#basic-configuration)
- [Protecting Routes](#protecting-routes)
- [Requesting an Access Token to call an API](#requesting-an-access-token-to-call-an-api)

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

### Protecting Routes

#### Route Middlware

In order to protect a Nuxt route, you can use the SDK's `useSession()` composable method in a custom route middleware. This will check if there is a session and redirect them to the login page if not:

```ts
// middleware/auth.ts
import { useSession } from '@auth0/auth0-nuxt';

export default defineNuxtRouteMiddleware((to, from) => {
  const session = useSession();

  if (!session.value) {
    return navigateTo(`/auth/login?returnTo=${to.path}`);
  }
});
```

> [!INFORMATION]  
> You can replace the check above with any check you want, such as checking for a specific user claim. The `useSession()` composable will return the session object if the user is authenticated.

With that middleware in place, you can protect routes by adding it to the `middleware` property of the corresponding Nuxt route:

```html
<script setup>
definePageMeta({
  middleware: [ 'auth' ],
});
</script>
```

#### Server Middleware
Additionally, you can also use a server middleware to protect server-side rendered routes. This middleware will check if the user is authenticated and redirect them to the login page if they are not:

```ts
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);

  if (url.pathname === '/private') {
    // TODO: See if there are alternative / better ways to access auth0Client
    const auth0Client = event.context.auth0Client;
    const session = await auth0Client.getSession({ event });
    if (!session) {
      return sendRedirect(event, `/auth/login?returnTo=${url.pathname}`);
    }
  }
});
```

> [!IMPORTANT]  
> The above examples are both to protect routes by the means of a session, and not API routes using a bearer token. 


### Requesting an Access Token to call an API

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

Retrieving the token can be achieved by using `getAccessToken`:

```ts
const auth0Client = event.context.auth0Client;
const accessTokenResult = await auth0Client.getAccessToken({ event });
console.log(accessTokenResult.accessToken);
```