import type { ModuleOptions } from '../src/module';

// Nuxt types the `auth0` config key through the generated `.nuxt` types of an app that loads the module. This package does
// not load itself, so the tests that pass module options to `setup({ nuxtConfig })` would not typecheck without this.
declare module 'nuxt/schema' {
  interface NuxtConfig {
    auth0?: Partial<ModuleOptions>;
  }
}
