import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addServerHandler,
  addServerPlugin,
  addRouteMiddleware,
  addImportsDir,
  addServerImportsDir,
  resolvePath,
} from '@nuxt/kit';
import type { Nuxt } from '@nuxt/schema';
import auth0Module from './module';

// Mock the @nuxt/kit module
vi.mock('@nuxt/kit', async () => {
  const actual = await vi.importActual('@nuxt/kit');
  return {
    ...actual,
    defineNuxtModule: vi.fn((config) => config),
    createResolver: vi.fn().mockReturnValue({
      resolve: (path: string) => `resolved/${path.replace(`./`, '')}`,
    }),
    addServerHandler: vi.fn(),
    addServerPlugin: vi.fn(),
    addRouteMiddleware: vi.fn(),
    addImportsDir: vi.fn(),
    addServerImportsDir: vi.fn(),
    resolvePath: vi.fn((path) => Promise.resolve(`resolved/user/${path}`)),
  };
});

describe('Auth0 Nuxt Module', () => {
  let mockNuxt: Nuxt;

  beforeEach(() => {
    // Reset mocks and the mock Nuxt instance before each test
    vi.clearAllMocks();
    mockNuxt = {
      options: {
        runtimeConfig: {
          public: {},
        },
        nitro: {
          alias: {},
        },
        build: {
          transpile: [],
        },
      },
    } as unknown as Nuxt;
  });

  it('should register server plugin, middleware and composables', async () => {
    // @ts-expect-error: module is a function
    await auth0Module.setup({}, mockNuxt);

    expect(addServerPlugin).toHaveBeenCalledWith('resolved/runtime/server/plugins/auth.server');
    expect(addRouteMiddleware).toHaveBeenCalledWith({
      name: 'auth0',
      path: 'resolved/runtime/middleware/auth.server',
      global: true,
    });
    expect(addImportsDir).toHaveBeenCalledWith('resolved/runtime/composables');
    expect(addServerImportsDir).toHaveBeenCalledWith('resolved/runtime/server/composables');
  });

  it('should not mount routes if mountRoutes is false', async () => {
    // Test with mountRoutes: false
    // @ts-expect-error: module is a function
    await auth0Module.setup({ mountRoutes: false }, mockNuxt);
    expect(addServerHandler).not.toHaveBeenCalled();
  });

  it('should mount default routes when mountRoutes is undefined', async () => {
    // @ts-expect-error: module is a function
    await auth0Module.setup({}, mockNuxt);

    expect(addServerHandler).toHaveBeenCalledTimes(4);
    expect(addServerHandler).toHaveBeenCalledWith({
      handler: 'resolved/runtime/server/api/auth/login.get',
      route: '/auth/login',
      method: 'get',
    });
    expect(addServerHandler).toHaveBeenCalledWith({
      handler: 'resolved/runtime/server/api/auth/callback.get',
      route: '/auth/callback',
      method: 'get',
    });
    expect(addServerHandler).toHaveBeenCalledWith({
      handler: 'resolved/runtime/server/api/auth/logout.get',
      route: '/auth/logout',
      method: 'get',
    });
    expect(addServerHandler).toHaveBeenCalledWith({
      handler: 'resolved/runtime/server/api/auth/backchannel-logout.post',
      route: '/auth/backchannel-logout',
      method: 'post',
    });
  });

  it('should mount custom routes when provided and mountRoutes is true', async () => {
    const customRoutes = {
      login: '/custom-login',
      logout: '/custom-logout',
      callback: '/custom-callback',
      backchannelLogout: '/custom-backchannel-logout',
    };

    // @ts-expect-error: module is a function
    await auth0Module.setup({ mountRoutes: true, routes: customRoutes }, mockNuxt);

    expect(addServerHandler).toHaveBeenCalledTimes(4);
    expect(addServerHandler).toHaveBeenCalledWith(expect.objectContaining({ route: '/custom-login' }));
    expect(addServerHandler).toHaveBeenCalledWith(expect.objectContaining({ route: '/custom-logout' }));
    expect(addServerHandler).toHaveBeenCalledWith(expect.objectContaining({ route: '/custom-callback' }));
    expect(addServerHandler).toHaveBeenCalledWith(expect.objectContaining({ route: '/custom-backchannel-logout' }));
  });

  it('should expose routes in public runtime config', async () => {
    const customRoutes = {
      login: '/custom-login',
    };
    const expectedRoutes = {
      login: '/custom-login',
      callback: '/auth/callback',
      logout: '/auth/logout',
      backchannelLogout: '/auth/backchannel-logout',
    };

    // @ts-expect-error: module is a function
    await auth0Module.setup({ routes: customRoutes }, mockNuxt);

    expect(mockNuxt.options.runtimeConfig.public.auth0).toEqual({
      routes: expectedRoutes,
    });
  });

  it('should set up default session store alias when no path is provided', async () => {
    // @ts-expect-error: module is a function
    await auth0Module.setup({}, mockNuxt);

    expect(mockNuxt.options.nitro.alias!['#auth0-session-store']).toBe(
      'resolved/runtime/server/utils/load-default-session-store'
    );
  });

  it('should set up session store alias from user-provided path', async () => {
    const sessionStoreFactoryPath = '~/server/my-session-store.ts';
    // @ts-expect-error: module is a function
    await auth0Module.setup({ sessionStoreFactoryPath }, mockNuxt);

    expect(resolvePath).toHaveBeenCalledWith(sessionStoreFactoryPath);
    expect(mockNuxt.options.nitro.alias!['#auth0-session-store']).toBe(`resolved/user/${sessionStoreFactoryPath}`);
  });
});
