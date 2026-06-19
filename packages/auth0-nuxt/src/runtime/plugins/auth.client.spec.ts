// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { useUserMock, fetchMock } = vi.hoisted(() => ({
  useUserMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/nuxt')>();
  return {
    ...actual,
    defineNuxtPlugin: (fn: any) => fn,
    useRuntimeConfig: vi.fn(() => ({
      public: { auth0: { routes: { profile: '/auth/profile' } } },
    })),
  };
});

vi.mock('../composables/use-user', () => ({ useUser: useUserMock }));

vi.stubGlobal('$fetch', fetchMock);

import plugin from './auth.client';

function makeNuxtApp() {
  const hooks: Record<string, () => Promise<void>> = {};
  return {
    hook: vi.fn((name: string, cb: () => Promise<void>) => { hooks[name] = cb; }),
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
    expect(fetchMock).toHaveBeenCalledWith('/auth/profile', expect.objectContaining({ retry: false }));
    expect(user.value).toEqual({ sub: 'hydrated' });
  });

  it('stays anonymous when the fetch fails', async () => {
    const user = { value: undefined as unknown };
    useUserMock.mockReturnValue(user);
    fetchMock.mockRejectedValue(new Error('network'));
    const nuxtApp = makeNuxtApp();
    await (plugin as unknown as (app: unknown) => Promise<void>)(nuxtApp);
    await nuxtApp.runHook('app:suspense:resolve');
    expect(user.value).toBeUndefined();
  });
});
