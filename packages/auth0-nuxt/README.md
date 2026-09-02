![Auth0-Nuxt](assets/images/banner.png)

The Auth0 Nuxt SDK is a library for implementing user authentication in Nuxt applications.

![Stage: GA Release](https://img.shields.io/badge/stage-ga-brightgreen)
![Release](https://img.shields.io/npm/v/@auth0/auth0-nuxt)
![Downloads](https://img.shields.io/npm/dw/@auth0/auth0-nuxt)
[![License](https://img.shields.io/:license-mit-blue.svg?style=flat)](https://opensource.org/licenses/MIT)

📚 [Documentation](#documentation) - 🚀 [Getting Started](#getting-started) - 💬 [Feedback](#feedback)

## Documentation

- [Examples](https://github.com/auth0/auth0-nuxt/blob/main/packages/auth0-nuxt/EXAMPLES.md) - examples for your different use cases.
- [Docs Site](https://auth0.com/docs) - explore our docs site and learn more about Auth0.

## Getting Started

### 1. Install the SDK

```shell
npm i @auth0/auth0-nuxt
```

This library requires Node.js 20 LTS and newer LTS versions.

### 2. Register the Auth0 Nuxt Module

The Auth0 Nuxt module is registered in the `nuxt.config.js` file, together with the runtime configuration. 

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

#### Routes

The SDK for Nuxt Web Applications mounts 5 main routes:

1. `/auth/login`: the login route that the user will be redirected to to initiate an authentication transaction. Supports adding a `returnTo` querystring parameter to return to a specific URL after login.
2. `/auth/logout`: the logout route that must be added to your Auth0 application's Allowed Logout URLs
3. `/auth/callback`: the callback route that must be added to your Auth0 application's Allowed Callback URLs
4. `/auth/backchannel-logout`: the route that will receive a `logout_token` when a configured [Back-Channel Logout](https://auth0.com/docs/authenticate/login/logout/back-channel-logout) initiator occurs
5. `/auth/profile`: returns the current user's claims to the browser, served `Cache-Control: no-store`. This is what populates `useUser()` on routes that opt out of the SSR user write (see [section 5](#5-controlling-the-ssr-user-write)).


To disable this behavior, you can set the `mountRoutes` option to `false` when registering the module (it's true by default):

```ts
modules: [['@auth0/auth0-nuxt', { mountRoutes: false }]]
```

Alternatively, if you wish to change the endpoint paths used for mounting, you can specify the `routes` option:

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

### 3. Adding Login and Logout

When using the built-in mounted routes, the user can be redirected to `/auth/login` to initiate the login flow and `/auth/logout` to log out.

```html
<a href="/auth/logout">Log out</a>
<a href="/auth/login">Log in</a>
```

When needed, you can also pass a `returnTo` querystring parameter to the login route to redirect the user back to a specific URL after login was successful.

When not using the built-in routes, you want to call the SDK's `startInteractiveLogin()`, `completeInteractiveLogin()` and `logout()` methods through the `useAuth0()` composable, which is available in the server-side context of your Nuxt application.:

```ts
// server/routes/auth/login.js
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const authorizationUrl = await auth0Client.startInteractiveLogin(
    {
      authorizationParams: {
        // Custom URL to redirect back to after login to handle the callback.
        // Make sure to configure the URL in the Auth0 Dashboard as an Allowed Callback URL.
        redirect_uri: 'http://localhost:3000/auth/callback',
      }
    }
  );

  sendRedirect(event, authorizationUrl.href);
});

// server/routes/auth/callback.js
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  await auth0Client.completeInteractiveLogin(
    new URL(event.node.req.url as string, 'http://localhost:3000')
  );

  sendRedirect(event, 'https://localhost:3000');
});

// server/routes/auth/logout.js
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const returnTo = 'https://localhost:3000';
  const logoutUrl = await auth0Client.logout(
    { returnTo: returnTo.toString() }
  );

  sendRedirect(event, logoutUrl.href);
});
```

With those in place, you will be able to call `auth/login` and `auth/logout` to log the user in and out of your application.


### 4. Protecting Routes

#### 4.1 Route Middleware

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

> [!INFORMATION]  
> You can replace the check above with any check you want, such as checking for a specific user claim.

With that middleware in place, you can protect routes by adding it to the `middleware` property of the corresponding Nuxt route:

```html
<script setup>
definePageMeta({
  middleware: [ 'auth' ],
});
</script>
```

#### 4.2 Server Middleware
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

### 5. Controlling the SSR user write

`useUser()` is backed by `useState`, which Nuxt serializes into the `__NUXT__` payload of server-rendered HTML. If that HTML is served from a shared cache, one visitor's claims can be delivered to another.

**This SDK cannot detect how your responses are cached.** `Cache-Control` set at request time with `setHeader`, and caching configured at your CDN (Vercel, Cloudflare, Fastly, CloudFront, `Netlify-CDN-Cache-Control`) are both invisible to it. If you serve authenticated routes from a shared cache, you must opt those routes out yourself. **The default is `ssrUser: true`, so a cached authenticated route with no `ssrUser: false` rule leaks.** The default is `true` to stay non-breaking.

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

A route rule always wins over the module option, which wins over the built-in default of `true`. Opted-out routes render anonymous HTML and hydrate `useUser()` in the browser from `/auth/profile`, which is served `Cache-Control: no-store`.

> [!IMPORTANT]
> **Do not protect an opted-out route with the `useUser()` route middleware from [section 4.1](#41-route-middleware).** On an opted-out route there is deliberately no user during SSR, so that middleware sees `session.value` as empty even for a signed-in user and redirects to `/auth/login`. Auth0 then returns them to the same route, which renders anonymous again — an infinite redirect loop.
>
> Protect these routes with the server middleware from [section 4.2](#42-server-middleware) instead. It reads the session from the H3 event, which is unaffected by `ssrUser`. The distinction is that `ssrUser: false` removes the user from the *rendered payload*, not from the session.

The `auth0` route-rule key is typed for you. The module registers the declaration with Nuxt, so it is in place after `nuxt prepare` with nothing to add to your own project.

Client hydration runs once at app init, not on every navigation: where SSR wrote the user the plugin is a no-op, and where it did not, the fetched user carries across later navigations. So `ssrUser: false` controls what lands in the cached HTML, not whether the user is visible in the running app.

If you set `mountRoutes: false`, mount the profile handler yourself, otherwise hydration has nothing to fetch and opted-out routes stay anonymous.

> [!WARNING]
> If you mount it at a path of your own, add a rule for that path:
>
> ```ts
> routeRules: { '/your/profile/path': { cache: false } }
> ```
>
> Nitro's handler cache is keyed by path without the session cookie, so a wildcard like `'/**': { swr: 60 }` would serve one user's claims to the next. The SDK already sets this for its own profile path.

### 6. Requesting an Access Token to call an API

If you need to call an API on behalf of the user, you want to specify the `audience` parameter when registering the plugin. This will make the SDK request an access token for the specified audience when the user logs in.

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


## Feedback

### Contributing

We appreciate feedback and contribution to this repo! Before you get started, please read the following:

- [Auth0's general contribution guidelines](https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md)
- [Auth0's code of conduct guidelines](https://github.com/auth0/open-source-template/blob/master/CODE-OF-CONDUCT.md)

### Raise an issue

To provide feedback or report a bug, please [raise an issue on our issue tracker](https://github.com/auth0/auth0-nuxt/issues).

## Vulnerability Reporting

Please do not report security vulnerabilities on the public GitHub issue tracker. The [Responsible Disclosure Program](https://auth0.com/responsible-disclosure-policy) details the procedure for disclosing security issues.

## What is Auth0?

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.auth0.com/website/sdks/logos/auth0_dark_mode.png" width="150">
    <source media="(prefers-color-scheme: light)" srcset="https://cdn.auth0.com/website/sdks/logos/auth0_light_mode.png" width="150">
    <img alt="Auth0 Logo" src="https://cdn.auth0.com/website/sdks/logos/auth0_light_mode.png" width="150">
  </picture>
</p>
<p align="center">
  Auth0 is an easy to implement, adaptable authentication and authorization platform. To learn more checkout <a href="https://auth0.com/why-auth0">Why Auth0?</a>
</p>
<p align="center">
  This project is licensed under the MIT license. See the <a href="https://github.com/auth0/auth0-nuxt/blob/main/packages/auth0-nuxt/LICENSE"> LICENSE</a> file for more info.
</p>
