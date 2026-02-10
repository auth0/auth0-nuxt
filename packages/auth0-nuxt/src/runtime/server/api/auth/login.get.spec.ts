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
    });
  });

  it('should call startInteractiveLogin with returnTo as undefined in case of invalid returnTo', async () => {
    getQueryMock.mockReturnValue({ returnTo: 'http://foo.bar:3000/foo' });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: undefined },
    });
  });

  it('should call sendRedirect with the returned url', async () => {
    mockAuth0Client.startInteractiveLogin.mockResolvedValue(new URL('http://localhost:3000/foo'));

    await loginHandler(mockEvent);

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, 'http://localhost:3000/foo');
  });

  it('should pass query params as authorizationParams', async () => {
    getQueryMock.mockReturnValue({
      connection: 'google-oauth2',
      returnTo: 'http://localhost:3000/dashboard'
    });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://localhost:3000/dashboard' },
      authorizationParams: { connection: 'google-oauth2' },
    });
  });

  it('should pass multiple query params as authorizationParams', async () => {
    getQueryMock.mockReturnValue({
      connection: 'Username-Password-Authentication',
      screen_hint: 'signup',
      prompt: 'login',
      returnTo: 'http://localhost:3000/profile'
    });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://localhost:3000/profile' },
      authorizationParams: {
        connection: 'Username-Password-Authentication',
        screen_hint: 'signup',
        prompt: 'login'
      },
    });
  });

  it('should not pass authorizationParams when only returnTo is provided', async () => {
    getQueryMock.mockReturnValue({
      returnTo: 'http://localhost:3000/tasks'
    });

    await loginHandler(mockEvent);

    expect(mockAuth0Client.startInteractiveLogin).toHaveBeenCalledWith({
      appState: { returnTo: 'http://localhost:3000/tasks' },
      authorizationParams: undefined,
    });
  });

  it('should exclude returnTo from authorizationParams', async () => {
    getQueryMock.mockReturnValue({
      connection: 'google-oauth2',
      audience: 'https://api.example.com',
      returnTo: 'http://localhost:3000/dashboard'
    });

    await loginHandler(mockEvent);

    const callArgs = mockAuth0Client.startInteractiveLogin.mock.calls[0]![0];
    expect(callArgs.authorizationParams).not.toHaveProperty('returnTo');
    expect(callArgs.authorizationParams).toEqual({
      connection: 'google-oauth2',
      audience: 'https://api.example.com'
    });
  });

});
