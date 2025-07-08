import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRouteUrl, toSafeRedirect } from './login.get';
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

  describe('createRouteUrl', () => {
    it('should create a URL object correctly', () => {
      const url = createRouteUrl('/path', 'http://example.com/base/');
      expect(url.href).toBe('http://example.com/base/path');
    });

    it('should handle base without trailing slash', () => {
      const url = createRouteUrl('/path', 'http://example.com/base');
      expect(url.href).toBe('http://example.com/base/path');
    });

    it('should handle url without leading slash', () => {
      const url = createRouteUrl('path', 'http://example.com/base/');
      expect(url.href).toBe('http://example.com/base/path');
    });
  });

  describe('toSafeRedirect', () => {
    const safeBaseUrl = 'http://localhost:3000';

    it('should return a safe URL if the origin matches', () => {
      const redirectUrl = '/private';
      const safeUrl = toSafeRedirect(redirectUrl, safeBaseUrl);
      expect(safeUrl).toBe('http://localhost:3000/private');
    });

    it('should return a safe URL for root path', () => {
      const redirectUrl = '/';
      const safeUrl = toSafeRedirect(redirectUrl, safeBaseUrl);
      expect(safeUrl).toBe('http://localhost:3000/');
    });

    it('should return undefined for an unsafe URL (different origin)', () => {
      const redirectUrl = 'http://malicious.com/exploit';
      const safeUrl = toSafeRedirect(redirectUrl, safeBaseUrl);
      expect(safeUrl).toBeUndefined();
    });

    it('should handle full URL with same origin', () => {
      const redirectUrl = 'http://localhost:3000/dashboard';
      const safeUrl = toSafeRedirect(redirectUrl, safeBaseUrl);
      expect(safeUrl).toBe('http://localhost:3000/dashboard');
    });
  });
});
