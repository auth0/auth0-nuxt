// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import type { Ref } from 'vue';
import { createHooks } from 'hookable';
import type { NuxtApp, RuntimeNuxtHooks } from 'nuxt/app';
import type { UserClaims } from '@auth0/auth0-server-js';

const { useUserMock, fetchMock } = vi.hoisted(() => {
  const mocks = {
    useUserMock: vi.fn<() => Ref<UserClaims | undefined>>(),
    fetchMock: vi.fn(),
  };
  vi.stubGlobal('$fetch', mocks.fetchMock);
  return mocks;
});

vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/nuxt')>();
  return {
    ...actual,
    defineNuxtPlugin: (fn: unknown) => fn,
    useRuntimeConfig: vi.fn(() => ({
      public: { auth0: { routes: { profile: '/auth/profile' } } },
    })),
  };
});

vi.mock('../composables/use-user', () => ({ useUser: useUserMock }));

import plugin from './auth.client';

/**
 * The plugin touches one thing on the app, `hook`, so the double is a real hookable behind a
 * `NuxtApp` face: `callHook` then runs the registered callback the way Nuxt does, awaiting it.
 */
function makeNuxtApp() {
  const hooks = createHooks<RuntimeNuxtHooks>();
  const hook = vi.spyOn(hooks, 'hook');
  const nuxtApp = { hook: hooks.hook.bind(hooks) } as NuxtApp;
  return { nuxtApp, hook, resolveSuspense: () => hooks.callHook('app:suspense:resolve') };
}

function anonymousUser() {
  const user = ref<UserClaims | undefined>(undefined);
  useUserMock.mockReturnValue(user);
  return user;
}

describe('auth.client plugin', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('does not fetch when the user is already populated', async () => {
    useUserMock.mockReturnValue(ref<UserClaims | undefined>({ sub: 'existing' }));
    const { nuxtApp, hook } = makeNuxtApp();
    await plugin(nuxtApp);
    expect(hook).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the profile and assigns the user after suspense resolves', async () => {
    const user = anonymousUser();
    fetchMock.mockResolvedValue({ sub: 'hydrated' });
    const { nuxtApp, hook, resolveSuspense } = makeNuxtApp();
    await plugin(nuxtApp);
    expect(hook).toHaveBeenCalledWith('app:suspense:resolve', expect.any(Function));
    await resolveSuspense();
    expect(fetchMock).toHaveBeenCalledWith('/auth/profile', {
      headers: { accept: 'application/json' },
      retry: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(user.value).toEqual({ sub: 'hydrated' });
    expect(warn).not.toHaveBeenCalled();
  });

  // The handler returns `null` for an anonymous caller, which must not become `null` on the
  // ref — `useUser()` is typed as `UserClaims | undefined`. An empty body means the same, and
  // neither is a misconfiguration worth a warning.
  it.each([null, undefined])('leaves the user unset, silently, when the endpoint answers %s', async (signedOut) => {
    const user = anonymousUser();
    fetchMock.mockResolvedValue(signedOut);
    const { nuxtApp, resolveSuspense } = makeNuxtApp();
    await plugin(nuxtApp);
    await resolveSuspense();
    expect(user.value).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  // With `mountRoutes: false` and a catch-all page, Nuxt answers `/auth/profile` with 200
  // text/html and ofetch resolves with the HTML as a string. Nothing but an object carrying a
  // `sub` may reach the ref, and the warning names the shape rather than echoing the body.
  it.each([
    ['<!DOCTYPE html><p>secret</p>', 'an HTML document'],
    ['plain', 'a string'],
    [42, 'a number'],
    [true, 'a boolean'],
    [['sub'], 'an array'],
    [{}, 'an object without a string `sub`'],
    [{ sub: 1 }, 'an object without a string `sub`'],
  ])('stays anonymous and warns when the endpoint answers %j instead of claims', async (notAUser, shape) => {
    const user = anonymousUser();
    fetchMock.mockResolvedValue(notAUser);
    const { nuxtApp, resolveSuspense } = makeNuxtApp();
    await plugin(nuxtApp);
    await resolveSuspense();
    expect(user.value).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain(`\`/auth/profile\` answered with ${shape} instead of user claims`);
    expect(message).toContain('mount the profile handler yourself');
    expect(message).not.toContain('secret');
    expect(warn.mock.calls[0]).toHaveLength(1);
  });

  it.each([
    [Object.assign(new Error('[GET] "/auth/profile": 404 Not Found'), { status: 404 }), 'HTTP 404'],
    [new TypeError('Failed to fetch'), 'TypeError'],
  ])('stays anonymous and warns when the fetch fails with %s', async (error, reason) => {
    const user = anonymousUser();
    fetchMock.mockRejectedValue(error);
    const { nuxtApp, resolveSuspense } = makeNuxtApp();
    await plugin(nuxtApp);
    await resolveSuspense();
    expect(user.value).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain(`Fetching \`/auth/profile\` failed with ${reason}`);
    expect(message).not.toContain('Not Found');
    expect(warn.mock.calls[0]).toHaveLength(1);
  });
});
