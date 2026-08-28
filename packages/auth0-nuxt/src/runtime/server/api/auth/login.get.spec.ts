import { describe, it, expect, beforeEach, vi } from 'vitest';
import loginHandler from './login.get';
import type { H3Event } from 'h3';

const { sendRedirectMock } = vi.hoisted(() => {
  return { sendRedirectMock: vi.fn() };
});

const { getQueryMock } = vi.hoisted(() => {
  return { getQueryMock: vi.fn() };
});

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  sendRedirect: sendRedirectMock,
  getQuery: getQueryMock,
}));

const mockAuth0Client = {
  startInteractiveLogin: vi.fn().mockResolvedValue({}),
};

vi.mock('../../composables/use-auth0', () => ({
  useAuth0: vi.fn(() => mockAuth0Client),
}));

describe('login.get handler', () => {
  const mockEvent = {
    context: {
      auth0ClientOptions: {
        appBaseUrl: 'http://localhost:3000',
      },
    },
    node: {
      res: {
        setHeader: vi.fn(),
      }
    }
  } as unknown as H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth0Client.startInteractiveLogin.mockResolvedValue(new URL('http://redirectTo'));
  });

  it('should call auth0Client startInteractiveLogin with the returnTo in case of valid returnTo', async () => {
    getQueryMock.mockReturnValue({ returnTo: 'http://localhost:3000/foo' });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://localhost:3000/foo' },
      authorizationParams: undefined,
    });
  });

  it('should call startInteractiveLogin with returnTo as undefined in case of invalid returnTo', async () => {
    getQueryMock.mockReturnValue({ returnTo: 'http://foo.bar:3000/foo' });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: undefined },
      authorizationParams: undefined,
    });
  });

  it('should forward additional query params as authorizationParams', async () => {
    getQueryMock.mockReturnValue({
      returnTo: 'http://localhost:3000/foo',
      organization: 'org_123',
      login_hint: 'user@example.com',
    });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://localhost:3000/foo' },
      authorizationParams: {
        organization: 'org_123',
        login_hint: 'user@example.com',
      },
    });
  });

  it('should not forward returnTo or reserved OAuth params as authorizationParams', async () => {
    getQueryMock.mockReturnValue({
      returnTo: 'http://localhost:3000/foo',
      scope: 'openid evil',
      audience: 'https://evil',
      redirect_uri: 'https://evil',
      client_id: 'evil',
      state: 'evil',
      nonce: 'evil',
      response_type: 'evil',
      code_challenge: 'evil',
      code_challenge_method: 'evil',
      organization: 'org_123',
    });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://localhost:3000/foo' },
      authorizationParams: {
        organization: 'org_123',
      },
    });
  });

  it('should not forward prototype-polluting keys as authorizationParams', async () => {
    getQueryMock.mockReturnValue({
      returnTo: 'http://localhost:3000/foo',
      __proto__: 'evil',
      constructor: 'evil',
      prototype: 'evil',
    });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://localhost:3000/foo' },
      authorizationParams: undefined,
    });
  });

  it('should call sendRedirect with the returned url', async () => {
    mockAuth0Client.startInteractiveLogin.mockResolvedValue(new URL('http://localhost:3000/foo'));

    await loginHandler(mockEvent);

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, 'http://localhost:3000/foo');
  });

});
