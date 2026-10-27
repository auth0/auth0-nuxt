// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// These tests keep the passkeys docs true: the code in EXAMPLES.md is the code of the example, the docs explain every
// status the routes answer, and every link points somewhere. They read the files of this repository, so they are meant
// for this repository only.

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const example = resolve(repo, 'examples/example-nuxt-passkeys');

const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const readExample = (file: string) => read(resolve(example, file));

const examplesPath = resolve(repo, 'packages/auth0-nuxt/EXAMPLES.md');
const readmePath = resolve(repo, 'packages/auth0-nuxt/README.md');
const exampleReadmePath = resolve(example, 'README.md');
const examplesMd = read(examplesPath);
const readmeMd = read(readmePath);
const exampleReadmeMd = read(exampleReadmePath);

/** A fenced code block. The fence may be indented (inside a list item), and the closing fence has the same indent. */
const FENCED = /^( *)```[^\n]*\n[\s\S]*?^\1```[ \t]*$/gm;

/** The text from `heading` up to the next `## ` heading. No code in these sections has a line that starts with `## `. */
function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n${heading}\n`);
  if (start === -1) throw new Error(`"${heading}" is not in the document`);
  const end = markdown.indexOf('\n## ', start + heading.length + 2);
  return markdown.slice(start + 1, end === -1 ? undefined : end);
}

/** The code of each fenced block, without the fences and without the indentation of the fence. */
function codeBlocks(markdown: string): string[] {
  return [...markdown.matchAll(FENCED)].map((match) => {
    const [block = '', indent = ''] = match;
    return block
      .split('\n')
      .slice(1, -1)
      .map((line) => line.slice(indent.length))
      .join('\n');
  });
}

/** The anchor that GitHub makes for a heading. */
const slug = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');

/** The anchors of the headings of a Markdown text. A `#` line inside a code block is not a heading. */
function anchorsOf(markdown: string): Set<string> {
  const headings = [...markdown.replace(FENCED, '').matchAll(/^#{1,6} +(.+?) *$/gm)];
  return new Set(headings.map(([, heading = '']) => slug(heading)));
}

/**
 * The links of a Markdown text that lead nowhere: a file or a heading that does not exist. A link to this repository
 * on GitHub (`blob/main` or `tree/main`) is looked up in this checkout. Links to other sites are not checked.
 */
function brokenLinks(markdown: string, file: string): string[] {
  const broken: string[] = [];
  for (const [, link = ''] of markdown.replace(FENCED, '').matchAll(/\]\(([^)\s]+)\)/g)) {
    let target: string;
    let fragment: string | undefined;

    if (link.startsWith('https://github.com/auth0/auth0-nuxt/')) {
      const match = /^https:\/\/github\.com\/auth0\/auth0-nuxt\/(?:blob|tree)\/main\/([^#]*)(?:#(.*))?$/.exec(link);
      if (!match) continue; // an issues link, for example
      target = resolve(repo, match[1] ?? '');
      fragment = match[2];
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(link)) {
      continue; // another site
    } else {
      const [relative = '', anchor] = link.split('#');
      target = relative ? resolve(dirname(file), relative) : file;
      fragment = anchor;
    }

    if (!existsSync(target) || (fragment && target.endsWith('.md') && !anchorsOf(read(target)).has(fragment))) {
      broken.push(link);
    }
  }
  return broken;
}

const docs = section(examplesMd, '## Login and Signup using Passkeys');
const contents = examplesMd.slice(0, examplesMd.indexOf('\n## '));

describe('the passkeys docs', () => {
  it.each([
    'server/api/passkey/signup/start.post.ts',
    'server/api/passkey/login/start.post.ts',
    'server/api/passkey/complete.post.ts',
  ])('H1: EXAMPLES.md shows %s as the example has it', (file) => {
    const source = readExample(file).trimEnd();

    expect(codeBlocks(docs).includes(source), `${file} differs from its copy in EXAMPLES.md`).toBe(true);
  });

  it('H1: EXAMPLES.md shows completeFailure() as the example has it', () => {
    const source = readExample('server/utils/passkey-failure.ts');
    const start = source.indexOf('export function completeFailure(');
    const end = source.indexOf('\n}\n', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const completeFailure = source.slice(start, end + 2);

    expect(
      codeBlocks(docs).some((block) => block.includes(completeFailure)),
      'completeFailure() differs from its copy in EXAMPLES.md'
    ).toBe(true);
  });

  it('H2: EXAMPLES.md explains every status the routes can answer', () => {
    const files = [
      'server/api/passkey/signup/start.post.ts',
      'server/api/passkey/login/start.post.ts',
      'server/api/passkey/complete.post.ts',
      'server/utils/passkey-failure.ts',
      'server/utils/passkey-guard.ts',
      'server/utils/passkey-input.ts',
    ];
    const statuses = [
      ...new Set(
        files.flatMap((file) =>
          [...readExample(file).matchAll(/status: '([a-z_]+)'/g)].map(([, status = '']) => status)
        )
      ),
    ].sort();

    // A new status is a conscious change: it needs a row in the docs and an entry here.
    expect(statuses).toEqual([
      'complete',
      'error',
      'failed',
      'forbidden',
      'invalid',
      'mfa_required',
      'rate_limited',
      'restart',
      'retry',
      'session_expired',
      'wait',
    ]);
    for (const status of statuses) {
      expect(docs.includes(`\`${status}\``), `the docs do not mention \`${status}\``).toBe(true);
    }
  });

  it.each([
    ['the passkeys section of EXAMPLES.md', examplesPath, docs],
    ['the contents of EXAMPLES.md', examplesPath, contents],
    ['the passkeys section of the package README', readmePath, section(readmeMd, '### 7. Passkeys')],
    ['the README of the example', exampleReadmePath, exampleReadmeMd],
  ])('H3: every link in %s leads to a file and a heading that exist', (_label, file, markdown) => {
    expect(brokenLinks(markdown, file)).toEqual([]);
  });

  it('H4: the README of the example explains every variable of .env.example', () => {
    const names = [...readExample('.env.example').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(([, name = '']) => name);

    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(exampleReadmeMd.includes(`\`${name}\``), `the README does not explain ${name}`).toBe(true);
    }
  });

  it('H5: the contents of EXAMPLES.md lists every heading of the passkeys section', () => {
    const headings = [...docs.replace(FENCED, '').matchAll(/^#{2,3} +(.+?) *$/gm)].map(([, heading = '']) => heading);

    expect(headings.length).toBeGreaterThan(5);
    for (const heading of headings) {
      expect(contents.includes(`[${heading}](#${slug(heading)})`), `the contents do not list "${heading}"`).toBe(true);
    }
  });
});
