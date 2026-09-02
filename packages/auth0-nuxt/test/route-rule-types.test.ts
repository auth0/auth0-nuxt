// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const run = promisify(execFile);
const require = createRequire(import.meta.url);

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const tsc = require.resolve('typescript/bin/tsc');

/**
 * Coverage for the route-rule type declaration the module hands to consuming apps.
 *
 * The unit tests in `src/module.spec.ts` mock `@nuxt/kit`, so they prove the module *asks*
 * Nuxt for the right template with the right contexts. They cannot prove Nuxt then puts that
 * declaration where a consumer's TypeScript actually looks. This test does that end to end:
 * it runs `nuxt prepare` against a fixture and compiles the projects Nuxt generates, once on
 * each major the module supports, because the two generate different type programs.
 *
 * The projects checked are the ones the contexts target:
 *   - the project that compiles `nuxt.config.*`, where a route rule is written
 *   - `tsconfig.server.json`, which compiles `server/**` where `getRouteRules` reads it back
 *
 * Each fixture's config also carries a `@ts-expect-error` on an unknown sibling key, so a
 * template that widened the interface rather than adding one key fails here too.
 */

/** The `nuxt` package a directory resolves, which is the one nuxi would run from there. */
const resolveNuxt = (from: string) => {
  const dir = dirname(createRequire(join(from, 'package.json')).resolve('nuxt/package.json'));
  const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string };
  return { dir, version };
};

/**
 * Gives the Nuxt 3 fixture a `node_modules` that resolves to Nuxt 3.
 *
 * Nuxt resolves `@nuxt/nitro-server`, and nuxi resolves `nuxt` itself, from the app's root
 * directory before falling back to their own location. A fixture inside this package would
 * therefore always pick up the Nuxt 4 hoisted to the repository root. The fixture cannot
 * install its own Nuxt 3 either: npm does not reify a workspace nested inside another
 * workspace's directory, and a nested `npm install` fails on the workspace root. So the
 * fixture links in the packages npm nested under the Nuxt 3 example instead, which is the
 * same tree a Nuxt 3 app in this repository already runs against.
 */
const linkNuxt3 = (fixture: string) => {
  const source = join(repoRoot, 'examples', 'example-nuxt-web', 'node_modules');
  const target = join(fixture, 'node_modules');

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target);
  for (const entry of readdirSync(source).filter((name) => !name.startsWith('.'))) {
    symlinkSync(join(source, entry), join(target, entry), 'junction');
  }
};

const fixtures = [
  {
    major: 4,
    name: 'route-rule-types',
    setup: () => {},
    // Nuxt 4 splits the type program. `tsconfig.node.json` compiles `nuxt.config.*` and takes
    // its references from `nuxt.node.d.ts`, which only the `node` context writes to.
    configProject: 'tsconfig.node.json',
    configReferences: 'nuxt.node.d.ts',
  },
  {
    major: 3,
    name: 'route-rule-types-nuxt3',
    setup: linkNuxt3,
    // Nuxt 3 has one app program, `tsconfig.json`, which includes `nuxt.config.*` and takes
    // its references from `nuxt.d.ts`. Its `@nuxt/kit` has no `node` context and ignores it.
    configProject: 'tsconfig.json',
    configReferences: 'nuxt.d.ts',
  },
];

describe.each(fixtures)('route-rule type declaration on Nuxt $major', ({ major, name, setup, configProject, configReferences }) => {
  const fixture = join(fileURLToPath(new URL('./fixtures', import.meta.url)), name);
  const nuxtDir = join(fixture, '.nuxt');

  /**
   * Compiles one generated project and asserts that `file`, relative to the fixture, is part
   * of it and reports no errors.
   *
   * Only that file's diagnostics count. Nuxt's include patterns sweep other things into each
   * program that are none of the module's business, such as the module's own runtime, whose
   * `~/src/types` alias does not resolve from a fixture, or on Nuxt 3 the `nuxt.config.ts`
   * that lands in the Nitro program without `defineNuxtConfig` in scope. The file list is
   * checked so a program that silently dropped the file cannot pass as clean.
   */
  const expectClean = async (project: string, file: string) => {
    const projectPath = join(nuxtDir, project);
    expect(existsSync(projectPath), `${project} should be generated`).toBe(true);

    const { stdout } = await run(process.execPath, [tsc, '--noEmit', '--listFiles', '--pretty', 'false', '-p', projectPath], {
      cwd: fixture,
    }).catch((error: { stdout?: string }) => {
      // tsc exits non-zero when it reports diagnostics; anything else is a broken run.
      if (!error.stdout?.includes('error TS')) throw error;
      return { stdout: error.stdout };
    });
    const lines = stdout.split('\n').map((line) => line.trim());

    const files = lines.filter((line) => isAbsolute(line)).map((line) => resolve(line));
    expect(files, `${file} should be in the ${project} program`).toContain(resolve(fixture, file));

    expect(lines.filter((line) => line.startsWith(`${file}(`))).toEqual([]);
  };

  beforeAll(async () => {
    setup(fixture);

    const nuxt = resolveNuxt(fixture);
    if (!nuxt.version.startsWith(`${major}.`)) {
      throw new Error(
        `Fixture ${name} resolves nuxt@${nuxt.version} but is meant to run on Nuxt ${major}. ` +
          'The Nuxt 3 fixture borrows the tree installed for examples/example-nuxt-web, so check ' +
          'that example still pins Nuxt 3 and that `npm install` has run at the repository root.'
      );
    }

    // The bin is spawned by path rather than through `npx nuxt`: which `nuxt` a `.bin` link
    // points at depends on how npm hoisted the two majors, and it must be this fixture's.
    await run(process.execPath, [join(nuxt.dir, 'bin', 'nuxt.mjs'), 'prepare'], { cwd: fixture });
  }, 180_000);

  it('writes the declaration into the app and references it for both type programs', () => {
    const declaration = join(nuxtDir, 'types', 'auth0-route-rules.d.ts');
    expect(existsSync(declaration)).toBe(true);

    const contents = readFileSync(declaration, 'utf8');
    expect(contents).toContain("declare module 'nitropack/types'");

    // Assert the references explicitly rather than relying on the compiles below to notice:
    // the config reference is the one a default `addTypeTemplate` call would miss on Nuxt 4.
    expect(readFileSync(join(nuxtDir, configReferences), 'utf8')).toContain('auth0-route-rules');
    expect(readFileSync(join(nuxtDir, 'types', 'nitro-nuxt.d.ts'), 'utf8')).toContain('auth0-route-rules');
  });

  it('typechecks the documented route rule in nuxt.config', async () => {
    await expectClean(configProject, 'nuxt.config.ts');
  }, 180_000);

  it('typechecks getRouteRules(event).auth0 in server code', async () => {
    await expectClean('tsconfig.server.json', 'server/api/route-rules.get.ts');
  }, 180_000);
});
