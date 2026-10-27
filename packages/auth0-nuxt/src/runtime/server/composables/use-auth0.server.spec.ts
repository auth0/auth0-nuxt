// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { useAuth0, type Auth0Client } from './use-auth0';
import { ServerClient, type PasskeyCredentialResponse, type ServerClientOptions } from '@auth0/auth0-server-js';
import type { H3Event } from 'h3';

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

vi.mock('#app/nuxt', () => ({
  useRuntimeConfig: useRuntimeConfigMock,
}));

const metaMock = vi.hoisted(() => ({
  importMetaServer: true,
  importMetaClient: false,
}));

vi.mock('../../helpers/import-meta', () => metaMock);

describe('useAuth0 server composable (server environment)', () => {
  let mockEvent: H3Event;
  const passkeyClient = {
    startSignup: vi.fn(),
    startLogin: vi.fn(),
    complete: vi.fn(),
  };
  const readPasskeyClient = vi.fn(() => passkeyClient);
  const mockServerClientInstance = {
    startInteractiveLogin: vi.fn(),
    getSession: vi.fn(),
    // A getter, like the real ServerClient: `readPasskeyClient` counts how often it is read.
    get passkey() {
      return readPasskeyClient();
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    vi.mocked(ServerClient).mockImplementation(function () { return mockServerClientInstance as any; });

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

  it('should pass stateIdentifier to ServerClient when provided', () => {
    mockEvent.context.auth0ClientOptions.stateIdentifier = 'custom-state-id';

    useAuth0(mockEvent);

    expect(ServerClient).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (ServerClient as Mock<any>).mock.calls[0]![0] as ServerClientOptions;

    expect(options.stateIdentifier).toBe('custom-state-id');
  });

  it('should pass transactionIdentifier to ServerClient when provided', () => {
    mockEvent.context.auth0ClientOptions.transactionIdentifier = 'custom-transaction-id';

    useAuth0(mockEvent);

    expect(ServerClient).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (ServerClient as Mock<any>).mock.calls[0]![0] as ServerClientOptions;

    expect(options.transactionIdentifier).toBe('custom-transaction-id');
  });

  it('should pass both stateIdentifier and transactionIdentifier to ServerClient when both are provided', () => {
    mockEvent.context.auth0ClientOptions.stateIdentifier = 'custom-state-id';
    mockEvent.context.auth0ClientOptions.transactionIdentifier = 'custom-transaction-id';

    useAuth0(mockEvent);

    expect(ServerClient).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (ServerClient as Mock<any>).mock.calls[0]![0] as ServerClientOptions;

    expect(options.stateIdentifier).toBe('custom-state-id');
    expect(options.transactionIdentifier).toBe('custom-transaction-id');
  });

  it('should not pass stateIdentifier or transactionIdentifier when not provided (backwards compatibility)', () => {
    useAuth0(mockEvent);

    expect(ServerClient).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (ServerClient as Mock<any>).mock.calls[0]![0] as ServerClientOptions;

    expect(options.stateIdentifier).toBeUndefined();
    expect(options.transactionIdentifier).toBeUndefined();
  });

  describe('passkey', () => {
    const credential: PasskeyCredentialResponse = {
      id: 'cred-id',
      rawId: 'cred-id',
      type: 'public-key',
      response: { clientDataJSON: 'e30' },
    };
    const requestOptions = { headers: { 'auth0-forwarded-for': '203.0.113.9' } };

    it('P1: startSignup forwards the options, the event and the request options, and returns the result', async () => {
      const result = { authnParamsPublicKey: { challenge: 'c' }, verificationRequired: ['email'] };
      passkeyClient.startSignup.mockResolvedValue(result);

      const returned = await useAuth0(mockEvent).passkey.startSignup({ email: 'a@example.com' }, requestOptions);

      expect(passkeyClient.startSignup).toHaveBeenCalledWith(
        { email: 'a@example.com' },
        { event: mockEvent },
        requestOptions
      );
      expect(returned).toBe(result);
    });

    it('P2: startLogin forwards its options, with or without them', async () => {
      const result = { authnParamsPublicKey: { challenge: 'c' } };
      passkeyClient.startLogin.mockResolvedValue(result);
      const auth0 = useAuth0(mockEvent);

      expect(await auth0.passkey.startLogin({ realm: 'db' }, requestOptions)).toBe(result);
      expect(passkeyClient.startLogin).toHaveBeenLastCalledWith({ realm: 'db' }, { event: mockEvent }, requestOptions);

      await auth0.passkey.startLogin();
      expect(passkeyClient.startLogin).toHaveBeenLastCalledWith(undefined, { event: mockEvent }, undefined);
    });

    it('P3: complete forwards the credential, the codes, the event and the request options', async () => {
      const result = {};
      passkeyClient.complete.mockResolvedValue(result);
      const options = { credential, verification: { email: '123456' } };

      const returned = await useAuth0(mockEvent).passkey.complete(options, requestOptions);

      expect(passkeyClient.complete).toHaveBeenCalledWith(options, { event: mockEvent }, requestOptions);
      expect(returned).toBe(result);
    });

    const calls = {
      startSignup: (auth0: Auth0Client) => auth0.passkey.startSignup({ email: 'a@example.com' }),
      startLogin: (auth0: Auth0Client) => auth0.passkey.startLogin(),
      complete: (auth0: Auth0Client) => auth0.passkey.complete({ credential }),
    };

    it.each(Object.keys(calls) as Array<keyof typeof calls>)(
      'P4: %s lets the error of the server client through unchanged',
      async (method) => {
        const error = new Error('boom');
        passkeyClient[method].mockRejectedValue(error);

        await expect(calls[method](useAuth0(mockEvent))).rejects.toBe(error);
      }
    );

    it('P5: does not read the passkey client until a method is called', async () => {
      const auth0 = useAuth0(mockEvent);
      expect(readPasskeyClient).not.toHaveBeenCalled();

      passkeyClient.startLogin.mockResolvedValue({});
      await auth0.passkey.startLogin();

      expect(readPasskeyClient).toHaveBeenCalledTimes(1);
    });
  });
});
