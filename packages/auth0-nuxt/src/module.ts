import {
  defineNuxtModule,
  createResolver,
  addServerHandler,
  addServerPlugin,
  addPlugin,
  addRouteMiddleware,
  addImportsDir,
  addServerImportsDir,
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
   * If set to false, you will need to manually mount the routes in your Nuxt server.
   * @default true
   */
  mountRoutes?: boolean;

  /**
   * The route URLs to use for the Auth0 module.
   * You can override the default routes by providing your own configuration.
   * @default { login: '/auth/login', callback: '/auth/callback', logout: '/auth/logout', backchannelLogout: '/auth/backchannel-logout' }
   */
  routes?: RouteConfig;

  /**
   * Path to a custom session store factory.
   * This allows you to provide a custom session store implementation to use stateful sessions.
   * The factory should default export a function that returns an object with the methods required by the Auth0 session store.
   * If not provided, the SDK will use stateless sessions and store everything in the cookie.
   */
  sessionStoreFactoryPath?: string;

  /**
   * Whether to populate `useUser()` during server-side rendering (which Nuxt serializes
   * into the `__NUXT__` payload of the SSR HTML).
   *
   * Set to `false` to skip the SSR user write for every route, keeping all server-rendered
   * HTML anonymous; the user is hydrated client-side from the profile endpoint instead. This
   * is the cache-mechanism-agnostic opt-out: unlike the automatic cache guard (which only
   * detects route-rule-based caching), it protects routes made cacheable in ways the module
   * cannot detect ahead of render (runtime headers, CDN-side config).
   *
   * A per-route `auth0: { ssrUser: … }` route rule overrides this default for that route,
   * so you can opt out globally and opt specific routes back in. Note that `ssrUser: true`
   * does not override the cache guard — shared-cacheable routes are always kept anonymous.
   * @default true
   */
  ssrUser?: boolean;
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
      // The module-level SSR user-write default; the middleware applies it when a route
      // rule does not set its own `auth0.ssrUser`. Defaults to `true`.
      ssrUser: options.ssrUser !== false,
    };

    addServerPlugin(resolver.resolve('./runtime/server/plugins/auth.server'));

    addRouteMiddleware({ name: 'auth0', path: resolver.resolve('./runtime/middleware/auth.server'), global: true });

    addPlugin(resolver.resolve('./runtime/plugins/auth.client'));

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
