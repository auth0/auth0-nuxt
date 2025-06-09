import {
  defineNuxtModule,
  createResolver,
  addServerHandler,
  addServerPlugin,
  addRouteMiddleware,
  addImportsDir,
} from '@nuxt/kit';

export default defineNuxtModule({
  meta: {
    name: 'auth0-nuxt',
    configKey: 'auth0',
  },
  async setup() {
    const resolver = createResolver(import.meta.url);

    addServerPlugin(resolver.resolve('./runtime/server/plugins/auth.server'));

    addRouteMiddleware({ name: 'auth0', path: resolver.resolve('./runtime/middleware/auth.server'), global: true });

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

    addImportsDir(resolver.resolve('./runtime/composables'));
  },
});