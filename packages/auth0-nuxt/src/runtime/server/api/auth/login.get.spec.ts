// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import loginHandler from './login.get';
import type { H3Event } from 'h3';

const { sendRedirectMock } = vi.hoisted(() => ({ sendRedirectMock: vi.fn() }));
const { getQueryMock } = vi.hoisted(() => ({ getQueryMock: vi.fn() }));
const { useRuntimeConfigMock } = vi.hoisted(() => ({
  useRuntimeConfigMock: vi.fn(() => ({ public: { auth0: { routes: { callback: '/auth/callback' } } } })),
}));

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  sendRedirect: sendRedirectMock,
  getQuery: getQueryMock,
}));

vi.mock('#app/nuxt', () => ({ useRuntimeConfig: useRuntimeConfigMock }));

const mockAuth0Client = {
  startInteractiveLogin: vi.fn().mockResolvedValue({}),
};

vi.mock('../../composables/use-auth0', () => ({
  useAuth0: vi.fn(() => mockAuth0Client),
}));

describe('login.get handler', () => {
  const mockEvent = {
    context: {
      auth0ClientOptions: { appBaseUrl: 'http://localhost:3000' },
    },
    node: { req: { headers: { host: 'localhost:3000' }, socket: {} }, res: { setHeader: vi.fn() } },
  } as unknown as H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth0Client.startInteractiveLogin.mockResolvedValue(new URL('http://redirectTo'));
  });

  it('passes the resolved redirect_uri and a valid returnTo', async () => {
    getQueryMock.mockReturnValue({ returnTo: 'http://localhost:3000/foo' });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://localhost:3000/foo' },
      authorizationParams: { redirect_uri: 'http://localhost:3000/auth/callback' },
    });
  });

  it('drops an unsafe returnTo', async () => {
    getQueryMock.mockReturnValue({ returnTo: 'http://foo.bar:3000/foo' });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: undefined },
      authorizationParams: { redirect_uri: 'http://localhost:3000/auth/callback' },
    });
  });

  it('resolves redirect_uri dynamically from the request host', async () => {
    getQueryMock.mockReturnValue({});
    const dynamicEvent = {
      context: { auth0ClientOptions: { appBaseUrl: undefined } },
      node: { req: { headers: { host: 'app2.localhost:3000' }, socket: {} }, res: { setHeader: vi.fn() } },
    } as unknown as H3Event;

    await loginHandler(dynamicEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://app2.localhost:3000/' },
      authorizationParams: { redirect_uri: 'http://app2.localhost:3000/auth/callback' },
    });
  });

  it('calls sendRedirect with the returned url', async () => {
    getQueryMock.mockReturnValue({});
    mockAuth0Client.startInteractiveLogin.mockResolvedValue(new URL('http://localhost:3000/foo'));

    await loginHandler(mockEvent);

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, 'http://localhost:3000/foo');
  });
});
