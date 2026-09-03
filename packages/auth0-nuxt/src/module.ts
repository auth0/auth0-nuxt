import {
  defineNuxtModule,
  createResolver,
  addServerHandler,
  addServerPlugin,
  addRouteMiddleware,
  addImportsDir,
  addServerImportsDir,
  addPlugin,
  extendRouteRules,
  resolvePath,
} from '@nuxt/kit';
import type { RouteConfig } from './types';

export * from './types';
export type { SessionConfiguration, SessionCookieOptions, StateData } from '@auth0/auth0-server-js';

/**
 * Module options for the Auth0 Nuxt module.
 */
export interface ModuleOptions {
  /**
   * Mount the Auth0 routes in the Nuxt server.
   * If set to false, you will need to manually mount the routes in your Nuxt server. That
   * includes the profile route: the client still fetches it to hydrate `useUser()` unless
   * `hydrateUser` is `false`.
   * @default true
   */
  mountRoutes?: boolean;

  /**
   * Whether to hydrate `useUser()` in the browser by fetching the profile route once the app
   * has mounted, on pages where server-side rendering did not write the user.
   *
   * Set to `false` when nothing serves the profile route, for example `mountRoutes: false`
   * without a handler of your own, so no request is made. With it off, routes that opt out of
   * `ssrUser` stay anonymous in the browser.
   * @default true
   */
  hydrateUser?: boolean;

  /**
   * The route URLs to use for the Auth0 module.
   * You can override the default routes by providing your own configuration.
   * @default { login: '/auth/login', callback: '/auth/callback', logout: '/auth/logout', backchannelLogout: '/auth/backchannel-logout', profile: '/auth/profile' }
   */
  routes?: RouteConfig;

  /**
   * Whether to populate `useUser()` during server-side rendering, which Nuxt serializes into
   * the `__NUXT__` payload of the rendered HTML.
   *
   * Set to `false` to keep every server-rendered page anonymous; the user is hydrated
   * client-side from the profile endpoint instead. A per-route `auth0: { ssrUser: … }` route
   * rule overrides this default, so you can opt out globally and opt individual routes back in.
   *
   * This SDK cannot detect how your responses are cached — `Cache-Control` set at request
   * time and CDN-side configuration are both invisible to it — so if you serve authenticated
   * routes from a shared cache, opt those routes out yourself.
   *
   * Note that an opted-out route cannot be protected by route middleware that checks
   * `useUser()`: there is no user during SSR, so such middleware would redirect a signed-in
   * user to the login route and Auth0 would return them to the same route, looping. Protect
   * these routes with server middleware reading the session from the H3 event instead.
   * @default true
   */
  ssrUser?: boolean;

  /**
   * Path to a custom session store factory.
   * This allows you to provide a custom session store implementation to use stateful sessions.
   * The factory should default export a function that returns an object with the methods required by the Auth0 session store.
   * If not provided, the SDK will use stateless sessions and store everything in the cookie.
   */
  sessionStoreFactoryPath?: string;
}

/**
 * @ignore
 */
export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'auth0-nuxt',
    configKey: 'auth0',
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);

    if (options.sessionStoreFactoryPath) {
      nuxt.options.nitro.alias = nuxt.options.nitro.alias || {};
      nuxt.options.nitro.alias['#auth0-session-store'] = await resolvePath(options.sessionStoreFactoryPath);
    } else {
      nuxt.options.nitro.alias = nuxt.options.nitro.alias || {};
      nuxt.options.nitro.alias['#auth0-session-store'] = resolver.resolve(
        './runtime/server/utils/load-default-session-store'
      );
    }

    const defaultRoutes = {
      login: '/auth/login',
      callback: '/auth/callback',
      logout: '/auth/logout',
      backchannelLogout: '/auth/backchannel-logout',
      profile: '/auth/profile',
    };

    const routes: Required<RouteConfig> = {
      ...defaultRoutes,
      ...options.routes,
    };

    // Expose the routes in the public runtime config so that it can be accessed in both server and client contexts
    nuxt.options.runtimeConfig.public.auth0 = {
      routes,
      // The module-level SSR user-write default. The `auth.server` Nitro plugin applies it
      // when a route rule does not set its own `auth0.ssrUser`.
      ssrUser: options.ssrUser !== false,
    };

    addServerPlugin(resolver.resolve('./runtime/server/plugins/auth.server'));

    addRouteMiddleware({ name: 'auth0', path: resolver.resolve('./runtime/middleware/auth.server'), global: true });

    if (options.hydrateUser !== false) {
      addPlugin(resolver.resolve('./runtime/plugins/auth.client'));
    }

    // Nitro's handler cache keys by path and ignores the session cookie, so a broad rule like
    // `'/**': { swr: 60 }` would serve one user's claims to the next. The endpoint's own
    // `no-store` does not save us: Nitro overwrites it. Kept outside the `mountRoutes` guard
    // because Nitro reads this from the route a handler is registered at, so an app mounting
    // the handler itself needs the rule too (and its own, if it picks a different path).
    extendRouteRules(routes.profile, { cache: false }, { override: true });

    if (options?.mountRoutes !== false) {
      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/login.get'),
        route: routes.login,
        method: 'get',
      });

      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/callback.get'),
        route: routes.callback,
        method: 'get',
      });

      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/logout.get'),
        route: routes.logout,
        method: 'get',
      });

      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/backchannel-logout.post'),
        route: routes.backchannelLogout,
        method: 'post',
      });

      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/profile.get'),
        route: routes.profile,
        method: 'get',
      });
    }

    addImportsDir(resolver.resolve('./runtime/composables'));
    addServerImportsDir(resolver.resolve('./runtime/server/composables'));
  },
});
