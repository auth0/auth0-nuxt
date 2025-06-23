import {
  defineNuxtModule,
  createResolver,
  addServerHandler,
  addServerPlugin,
  addRouteMiddleware,
  addImportsDir,
  addServerImportsDir,
  resolvePath,
} from '@nuxt/kit';

export * from './types';
export type { SessionConfiguration, SessionCookieOptions, StateData } from '@auth0/auth0-server-js';

export interface ModuleOptions {
  mountRoutes?: boolean;
  sessionStoreFactoryPath?: string;
}

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
      nuxt.options.nitro.alias['#auth0-session-store'] = resolver.resolve('./runtime/server/utils/load-default-session-store');
    }

    addServerPlugin(resolver.resolve('./runtime/server/plugins/auth.server'));

    addRouteMiddleware({ name: 'auth0', path: resolver.resolve('./runtime/middleware/auth.server'), global: true });

    if (options?.mountRoutes) {
      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/login.get'),
        route: '/auth/login',
        method: 'get',
      });

      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/callback.get'),
        route: '/auth/callback',
        method: 'get',
      });

      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/logout.get'),
        route: '/auth/logout',
        method: 'get',
      });

      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/profile.get'),
        route: '/auth/profile',
        method: 'get',
      });

      addServerHandler({
        handler: resolver.resolve('./runtime/server/api/auth/backchannel-logout.post'),
        route: '/auth/backchannel-logout',
        method: 'post',
      });
    }

    addImportsDir(resolver.resolve('./runtime/composables'));
    addServerImportsDir(resolver.resolve('./runtime/server/composables'));
  },
});
