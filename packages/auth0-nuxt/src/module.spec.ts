import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addServerHandler,
  addTypeTemplate,
  addServerPlugin,
  addRouteMiddleware,
  addImportsDir,
  addServerImportsDir,
  addPlugin,
  extendRouteRules,
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
    addPlugin: vi.fn(),
    addTypeTemplate: vi.fn(),
    extendRouteRules: vi.fn(),
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
    expect(addPlugin).toHaveBeenCalledWith('resolved/runtime/plugins/auth.client');
    expect(addImportsDir).toHaveBeenCalledWith('resolved/runtime/composables');
    expect(addServerImportsDir).toHaveBeenCalledWith('resolved/runtime/server/composables');
  });

  // This proves the module asks kit for the right template. `@nuxt/kit` is mocked here, so what
  // Nuxt then does with it is covered end to end in `test/route-rule-types.test.ts`, which runs
  // `nuxt prepare` on a consumer fixture for each supported major and typechecks the result.
  it('should register the route-rule types with Nuxt so consumers do not declare them', async () => {
    // @ts-expect-error: module is a function
    await auth0Module.setup({}, mockNuxt);

    expect(addTypeTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'types/auth0-route-rules.d.ts' }),
      // `node` is not optional: `.nuxt/tsconfig.node.json` is the project that compiles
      // `nuxt.config.*`, so without it the key is still an excess property where it is
      // written. `nitro` carries it to the server program, where `getRouteRules` is read.
      { nuxt: true, node: true, nitro: true }
    );
  });

  it('should declare the auth0 key on both nitro route-rule interfaces', async () => {
    // @ts-expect-error: module is a function
    await auth0Module.setup({}, mockNuxt);

    expect(addTypeTemplate).toHaveBeenCalledTimes(1);

    const call = vi.mocked(addTypeTemplate).mock.calls[0];
    if (!call) {
      throw new Error('addTypeTemplate was not called, so there is no template to inspect');
    }

    // @ts-expect-error: getContents is called by Nuxt with template data we do not need here
    const contents = call[0].getContents({});

    expect(contents).toContain("declare module 'nitropack/types'");
    expect(contents).toContain('interface NitroRouteRules extends Auth0NitroRules {}');
    expect(contents).toContain('interface NitroRouteConfig extends Auth0NitroRules {}');
    expect(contents).toContain('auth0?: { ssrUser?: boolean };');
  });

  it('should not mount routes if mountRoutes is false', async () => {
    // Test with mountRoutes: false
    // @ts-expect-error: module is a function
    await auth0Module.setup({ mountRoutes: false }, mockNuxt);
    expect(addServerHandler).not.toHaveBeenCalled();
  });

  it('should opt the profile route out of Nitro caching even when mountRoutes is false', async () => {
    // An app that mounts the profile handler itself still needs this rule: Nitro decides
    // whether to cache from the route a handler is registered at, so without it a broad
    // `'/**': { swr: 60 }` would cache one user's claims and serve them to the next.
    // @ts-expect-error: module is a function
    await auth0Module.setup({ mountRoutes: false }, mockNuxt);

    expect(extendRouteRules).toHaveBeenCalledWith('/auth/profile', { cache: false }, { override: true });
  });

  it('should opt the profile route out of Nitro caching', async () => {
    // Nitro keys cached responses by path without the session cookie and overwrites the
    // handler's own `Cache-Control`, so a broad rule like `'/**': { swr: 60 }` would let it
    // serve one user's claims to another. `cache: false` on the exact path prevents that.
    // @ts-expect-error: module is a function
    await auth0Module.setup({}, mockNuxt);

    expect(extendRouteRules).toHaveBeenCalledWith('/auth/profile', { cache: false }, { override: true });
  });

  it('should opt a custom profile route out of Nitro caching', async () => {
    // @ts-expect-error: module is a function
    await auth0Module.setup({ routes: { profile: '/custom-profile' } }, mockNuxt);

    expect(extendRouteRules).toHaveBeenCalledWith('/custom-profile', { cache: false }, { override: true });
  });

  it('should mount default routes when mountRoutes is undefined', async () => {
    // @ts-expect-error: module is a function
    await auth0Module.setup({}, mockNuxt);

    expect(addServerHandler).toHaveBeenCalledTimes(5);
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
    expect(addServerHandler).toHaveBeenCalledWith({
      handler: 'resolved/runtime/server/api/auth/profile.get',
      route: '/auth/profile',
      method: 'get',
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

    expect(addServerHandler).toHaveBeenCalledTimes(5);
    expect(addServerHandler).toHaveBeenCalledWith(expect.objectContaining({ route: '/custom-login' }));
    expect(addServerHandler).toHaveBeenCalledWith(expect.objectContaining({ route: '/custom-logout' }));
    expect(addServerHandler).toHaveBeenCalledWith(expect.objectContaining({ route: '/custom-callback' }));
    expect(addServerHandler).toHaveBeenCalledWith(expect.objectContaining({ route: '/custom-backchannel-logout' }));
    expect(addServerHandler).toHaveBeenCalledWith(expect.objectContaining({ route: '/auth/profile' }));
  });

  it('should mount a custom profile route when provided', async () => {
    // @ts-expect-error: module is a function
    await auth0Module.setup({ routes: { profile: '/custom-profile' } }, mockNuxt);

    expect(addServerHandler).toHaveBeenCalledWith({
      handler: 'resolved/runtime/server/api/auth/profile.get',
      route: '/custom-profile',
      method: 'get',
    });
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
      profile: '/auth/profile',
    };

    // @ts-expect-error: module is a function
    await auth0Module.setup({ routes: customRoutes }, mockNuxt);

    expect(mockNuxt.options.runtimeConfig.public.auth0).toEqual({
      routes: expectedRoutes,
      ssrUser: true,
    });
  });

  it('exposes ssrUser: false in public runtime config when opted out globally', async () => {
    // @ts-expect-error: module is a function
    await auth0Module.setup({ ssrUser: false }, mockNuxt);

    expect((mockNuxt.options.runtimeConfig.public.auth0 as { ssrUser: boolean }).ssrUser).toBe(false);
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
