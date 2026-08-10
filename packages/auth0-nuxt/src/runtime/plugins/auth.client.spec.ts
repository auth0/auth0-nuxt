// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { useUserMock, fetchMock } = vi.hoisted(() => {
  const mocks = {
    useUserMock: vi.fn(),
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

function makeNuxtApp() {
  const hooks: Record<string, () => Promise<void>> = {};
  const hookFn = (name: string, cb: () => Promise<void>) => {
    hooks[name] = cb;
  };
  return {
    hook: vi.fn(hookFn),
    runHook: (name: string) => hooks[name]?.(),
  };
}

describe('auth.client plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when the user is already populated', async () => {
    useUserMock.mockReturnValue({ value: { sub: 'existing' } });
    const nuxtApp = makeNuxtApp();
    await (plugin as unknown as (app: unknown) => Promise<void>)(nuxtApp);
    expect(nuxtApp.hook).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the profile and assigns the user after suspense resolves', async () => {
    const user = { value: undefined as unknown };
    useUserMock.mockReturnValue(user);
    fetchMock.mockResolvedValue({ sub: 'hydrated' });
    const nuxtApp = makeNuxtApp();
    await (plugin as unknown as (app: unknown) => Promise<void>)(nuxtApp);
    expect(nuxtApp.hook).toHaveBeenCalledWith('app:suspense:resolve', expect.any(Function));
    await nuxtApp.runHook('app:suspense:resolve');
    expect(fetchMock).toHaveBeenCalledWith('/auth/profile', {
      headers: { accept: 'application/json' },
      retry: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(user.value).toEqual({ sub: 'hydrated' });
  });

  it('leaves the user unset when the endpoint reports nobody is signed in', async () => {
    const user = { value: undefined as unknown };
    useUserMock.mockReturnValue(user);
    // The handler returns `null` for an anonymous caller, which must not become `null` on the
    // ref — `useUser()` is typed as `UserClaims | undefined`.
    fetchMock.mockResolvedValue(null);
    const nuxtApp = makeNuxtApp();
    await (plugin as unknown as (app: unknown) => Promise<void>)(nuxtApp);
    await nuxtApp.runHook('app:suspense:resolve');
    expect(user.value).toBeUndefined();
  });

  it('stays anonymous when the fetch fails', async () => {
    const user = { value: undefined as unknown };
    useUserMock.mockReturnValue(user);
    fetchMock.mockRejectedValue(new Error('network'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nuxtApp = makeNuxtApp();
    await (plugin as unknown as (app: unknown) => Promise<void>)(nuxtApp);
    await nuxtApp.runHook('app:suspense:resolve');
    expect(user.value).toBeUndefined();
    warn.mockRestore();
  });
});
