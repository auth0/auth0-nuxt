import { describe, it, expect, beforeEach, vi } from 'vitest';
import loginHandler from './login.get';

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

});
