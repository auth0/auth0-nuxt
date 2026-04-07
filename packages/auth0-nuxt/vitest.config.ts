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
  test: {
    environment: 'nuxt',
  },
})