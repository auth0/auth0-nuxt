import {
  defineNuxtModule,
  createResolver,
  addServerHandler,
  addServerPlugin,
  addRouteMiddleware,
  addImportsDir,
  addServerImportsDir,
} from '@nuxt/kit';

export default defineNuxtModule({
  meta: {
    name: 'auth0-nuxt',
    configKey: 'auth0',
  },
  async setup(options) {
    const resolver = createResolver(import.meta.url);

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
    addServerImportsDir(resolver.resolve('./runtime/server/composables'))
  },
});
