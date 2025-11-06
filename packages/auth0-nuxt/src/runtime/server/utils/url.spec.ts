import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRouteUrl, toSafeRedirect } from './url';


const mockAuth0Client = {
  startInteractiveLogin: vi.fn().mockResolvedValue({}),
};

vi.mock('../../composables/use-auth0', () => ({
  useAuth0: vi.fn(() => mockAuth0Client),
}));

describe('login.get handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth0Client.startInteractiveLogin.mockResolvedValue(new URL('http://redirectTo'));
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
