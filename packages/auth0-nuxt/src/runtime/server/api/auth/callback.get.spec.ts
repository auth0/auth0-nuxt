import { describe, it, expect, vi, beforeEach } from 'vitest';
import callbackHandler from './callback.get';
import type { H3Event } from 'h3';

const { sendRedirectMock } = vi.hoisted(() => {
  return { sendRedirectMock: vi.fn() };
});

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  sendRedirect: sendRedirectMock,
}));

const mockAuth0Client = {
  completeInteractiveLogin: vi.fn().mockResolvedValue({}),
};

vi.mock('../../composables/use-auth0', () => ({
  useAuth0: vi.fn(() => mockAuth0Client),
}));

describe('callback.get handler', () => {
  const mockEvent = {
    context: {
      auth0ClientOptions: {
        appBaseUrl: 'http://localhost:3000',
      },
    },
    node: {
      req: {
        url: 'foo',
      },
    },
  } as unknown as H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth0Client.completeInteractiveLogin.mockResolvedValue({});
  });

  it('should call auth0Client completeInteractiveLogin with the url', async () => {
    await callbackHandler(mockEvent);
    expect(mockAuth0Client.completeInteractiveLogin).toHaveBeenCalledWith(new URL('foo', 'http://localhost:3000'));
  });

  it('should redirect to the returnTo url if provided', async () => {
    mockAuth0Client.completeInteractiveLogin.mockResolvedValue({
      appState: { returnTo: 'http://localhost:3000/foo' },
    });
    await callbackHandler(mockEvent);

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, 'http://localhost:3000/foo');
  });

  it('should redirect to the appBaseUrl if no returnTo url is provided', async () => {
    await callbackHandler(mockEvent);

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, 'http://localhost:3000');
  });
});
