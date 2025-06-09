import {
  defineNuxtModule,
  createResolver,
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
    addImportsDir(resolver.resolve('./runtime/composables'));
  },
});