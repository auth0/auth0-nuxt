import {
  defineNuxtModule,
  createResolver,
  addServerPlugin,
} from '@nuxt/kit';

export default defineNuxtModule({
  meta: {
    name: 'auth0-nuxt',
    configKey: 'auth0',
  },
  async setup() {
    const resolver = createResolver(import.meta.url);

    addServerPlugin(resolver.resolve('./runtime/server/plugins/auth.server'));
  },
});