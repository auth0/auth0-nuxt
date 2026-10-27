import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadNuxt, writeTypes } from '@nuxt/kit';

// The passkeys fixture builds the app of examples/example-nuxt-passkeys. Vite reads the tsconfig.json of that example for
// every file of it, and that file extends .nuxt/tsconfig.json, which only `nuxt prepare` (or a build) writes. A fresh
// checkout does not have it, so every test that builds the fixture fails with a TSCONFIG_ERROR. Write it here when it is
// missing. The example names the module by its package name, which resolves to dist/ and needs a build, so the name points
// at the source instead.
const example = fileURLToPath(new URL('../../../examples/example-nuxt-passkeys', import.meta.url));
const moduleSource = fileURLToPath(new URL('../src/module', import.meta.url));

export default async function prepareExample(): Promise<void> {
  if (existsSync(`${example}/.nuxt/tsconfig.json`)) return;

  const nuxt = await loadNuxt({
    cwd: example,
    ready: false,
    overrides: { _prepare: true, alias: { '@auth0/auth0-nuxt': moduleSource } },
  });
  try {
    await nuxt.ready();
    await writeTypes(nuxt);
  } finally {
    await nuxt.close();
  }
}
