import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { useAuth0, type Auth0Client } from './use-auth0';
import { ServerClient, type ServerClientOptions } from '@auth0/auth0-server-js';
import type { H3Event } from 'h3';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';

vi.mock('@auth0/auth0-server-js', async (importOriginal) => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const actual = await importOriginal<any>();
  return {
    ...actual,
    ServerClient: vi.fn(),
  };
});

const { useRuntimeConfigMock } = vi.hoisted(() => {
  return {
    useRuntimeConfigMock: vi.fn(() => {
      return {
        public: {
          auth0: {
            routes: {
              callback: '/auth/callback',
            },
          },
        },
      };
    }),
  };
});

mockNuxtImport('useRuntimeConfig', () => {
  return useRuntimeConfigMock;
});

const metaMock = vi.hoisted(() => ({
  importMetaServer: true,
  importMetaClient: false,
}));

vi.mock('../../helpers/import-meta', () => metaMock);

describe('useAuth0 server composable (server environment)', () => {
  let mockEvent: H3Event;
  const mockServerClientInstance = {
    startInteractiveLogin: vi.fn(),
    getSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    vi.mocked(ServerClient).mockImplementation(() => mockServerClientInstance as any);

    mockEvent = {
      context: {
        auth0ClientOptions: {
          domain: 'test.auth0.com',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          appBaseUrl: 'http://localhost:3000',
          sessionSecret: 'test-secret',
        },
      },
    } as unknown as H3Event;

    metaMock.importMetaServer = true;
    metaMock.importMetaClient = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw an error if no event is provided', () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    expect(() => useAuth0(undefined as any)).toThrow(
      'useAuth0() can not be called without passing an H3Event instance.'
    );
  });

  it('should create and cache a ServerClient instance on the event context', () => {
    useAuth0(mockEvent);

    // It should have created a new instance
    expect(ServerClient).toHaveBeenCalledTimes(1);
    expect(mockEvent.context.auth0Client).toBeDefined();
    expect(mockEvent.context.auth0Client).toBe(mockServerClientInstance);

    // Call it again with the same event
    useAuth0(mockEvent);

    // It should NOT create a new instance, but reuse the cached one
    expect(ServerClient).toHaveBeenCalledTimes(1);
  });

  it('should return a wrapped Auth0Client instance', async () => {
    const auth0: Auth0Client = useAuth0(mockEvent);

    // Test if the wrapper calls the underlying client with the event context
    await auth0.getSession();
    expect(mockServerClientInstance.getSession).toHaveBeenCalledWith({ event: mockEvent });

    await auth0.startInteractiveLogin();
    expect(mockServerClientInstance.startInteractiveLogin).toHaveBeenCalledWith(undefined, { event: mockEvent });
  });

  it('should fail on the client', async () => {
    metaMock.importMetaServer = false;
    metaMock.importMetaClient = true;

    expect(() => useAuth0(mockEvent)).toThrow('The `useAuth0` composable should only be used on the server.');
  });

  it('should correctly configure the redirect_uri when using a sub directory with appBaseUrl', () => {
    mockEvent.context.auth0ClientOptions.appBaseUrl = 'http://localhost:3000/subdir';

    useAuth0(mockEvent);

    expect(ServerClient).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (ServerClient as Mock<any>).mock.calls[0]![0] as ServerClientOptions;

    expect(options.authorizationParams!.redirect_uri).toBe('http://localhost:3000/subdir/auth/callback');
  });

  it('should correctly configure the redirect_uri when using a sub directory with appBaseUrl and a custom callback route', () => {
    mockEvent.context.auth0ClientOptions.appBaseUrl = 'http://localhost:3000/subdir';

    useRuntimeConfigMock.mockImplementation(() => {
      return { public: { auth0: { routes: { callback: '/auth/custom-callback' } } } };
    });

    useAuth0(mockEvent);

    expect(ServerClient).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (ServerClient as Mock<any>).mock.calls[0]![0] as ServerClientOptions;

    expect(options.authorizationParams!.redirect_uri).toBe('http://localhost:3000/subdir/auth/custom-callback');
  });
});
