import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const server = fileURLToPath(new URL('../../.output/server/index.mjs', import.meta.url));
const auth0Mock = fileURLToPath(new URL('./auth0-mock.mjs', import.meta.url));

/** The fake Auth0 tenant the app is pointed at. Nothing listens there: auth0-mock.mjs answers its requests. */
export const domain = 'example.auth0.local';
export const clientId = 'test-client-id';
/** The user the fake Auth0 logs in. */
export const user = { sub: 'auth0|123', name: 'Ada Lovelace', email: 'ada@example.com' };

export type App = { origin: string; stop(): Promise<void> };

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Starts the built example (`nuxt build` output) in its own process, with auth0-mock.mjs preloaded so that every
 * request the SDK sends to Auth0 is answered in-process by MSW.
 */
export async function startApp(): Promise<App> {
  if (!existsSync(server)) {
    throw new Error('The example is not built. Run `npm run build -w example-nuxt-web` first.');
  }

  const port = await freePort();
  const origin = `http://localhost:${port}`;
  let output = '';

  const child = spawn('node', [server], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_OPTIONS: `--import=${auth0Mock}`,
      NITRO_PORT: String(port),
      NUXT_AUTH0_DOMAIN: domain,
      NUXT_AUTH0_CLIENT_ID: clientId,
      NUXT_AUTH0_CLIENT_SECRET: 'test-client-secret',
      NUXT_AUTH0_SESSION_SECRET: 'a-session-secret-of-at-least-thirty-two-characters',
      NUXT_AUTH0_APP_BASE_URL: origin,
      MOCK_AUTH0_USER: JSON.stringify(user),
    },
  });
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));

  const stop = async () => {
    child.kill();
    await exited;
  };

  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`The example exited while starting:\n${output}`);
    try {
      await fetch(`${origin}/public`);
      return { origin, stop };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  await stop();
  throw new Error(`The example did not start within 10 seconds:\n${output}`);
}
