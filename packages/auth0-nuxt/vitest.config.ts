import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  // Workaround for Nuxt adding 'import' to SSR resolve conditions, which breaks CJS/ESM interop.
  // See: https://github.com/nuxt/nuxt/pull/34739
  // See: https://github.com/vitest-dev/vitest/issues/10012#issuecomment-4149566016
  plugins: [
    {
      name: 'patch-conditions',
      enforce: 'post',
      configEnvironment(name, config) {
        if (name === 'ssr') {
          config.resolve!.conditions = config.resolve!.conditions!.filter(
            (c: string) => c !== 'import'
          )
        }
      },
    },
  ],
  // Nuxt compiles `import.meta.dev` to `false` for the test build. Unit specs cover dev-only
  // warnings, so turn it back on here; the e2e fixtures build separately and are unaffected.
  define: {
    'import.meta.dev': 'true',
  },
  test: {
    environment: 'nuxt',
  },
})