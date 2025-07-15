import { describe, it, expect, vi, beforeEach } from 'vitest';
import logoutHandler from './logout.get';
import type { H3Event } from 'h3';

const { sendRedirectMock } = vi.hoisted(() => {
  return { sendRedirectMock: vi.fn() };
});

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  sendRedirect: sendRedirectMock,
}));

const mockAuth0Client = {
  logout: vi.fn(),
};

vi.mock('../../composables/use-auth0', () => ({
  useAuth0: vi.fn(() => mockAuth0Client),
}));

describe('logout.get handler', () => {
  const mockEvent = {
    context: {
      auth0ClientOptions: {
        appBaseUrl: 'http://localhost:3000',
      },
    },
  } as unknown as H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth0Client.logout.mockResolvedValue(new URL('http://external/logout'));
  });

  it('should call auth0Client logout with appBaseUrl as returnTo', async () => {
    await logoutHandler(mockEvent);
    expect(mockAuth0Client.logout).toHaveBeenCalledWith({
      returnTo: 'http://localhost:3000',
    });
  });

  it('should call sendRedirect with the returned url', async () => {
    await logoutHandler(mockEvent);

    expect(sendRedirectMock).toHaveBeenCalledWith(mockEvent, 'http://external/logout');
  });
});
