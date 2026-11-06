import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadNuxt, writeTypes } from '@nuxt/kit';

// The passkeys and stateful-sessions fixtures build the app of examples/example-nuxt-passkeys and
// examples/example-nuxt-stateful-sessions. Vite reads the tsconfig.json of that example for every file of it, and that file
// extends .nuxt/tsconfig.json, which only `nuxt prepare` (or a build) writes. A fresh checkout does not have it, so every
// test that builds the fixture fails with a TSCONFIG_ERROR. Write it here when it is missing. The example names the module
// by its package name, which resolves to dist/ and needs a build, so the name points at the source instead.
const examples = ['example-nuxt-passkeys', 'example-nuxt-stateful-sessions'].map((name) =>
  fileURLToPath(new URL(`../../../examples/${name}`, import.meta.url))
);
const moduleSource = fileURLToPath(new URL('../src/module', import.meta.url));

async function prepareExample(example: string): Promise<void> {
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

export default async function prepareExamples(): Promise<void> {
  for (const example of examples) {
    await prepareExample(example);
  }
}
