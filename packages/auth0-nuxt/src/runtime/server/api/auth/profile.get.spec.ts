import { describe, it, expect, vi, beforeEach } from 'vitest';
import profileHandler from './profile.get';
import type { H3Event } from 'h3';

const { setHeaderMock } = vi.hoisted(() => ({ setHeaderMock: vi.fn() }));

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  setHeader: setHeaderMock,
}));

const mockAuth0Client = {
  getUser: vi.fn(),
};

vi.mock('../../composables/use-auth0', () => ({
  useAuth0: vi.fn(() => mockAuth0Client),
}));

describe('profile.get handler', () => {
  const mockEvent = { context: {} } as unknown as H3Event;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets Cache-Control: no-store', async () => {
    mockAuth0Client.getUser.mockResolvedValue({ sub: 'user-1' });
    await profileHandler(mockEvent);
    expect(setHeaderMock).toHaveBeenCalledWith(mockEvent, 'Cache-Control', 'no-store');
  });

  it('sets Vary: Cookie', async () => {
    mockAuth0Client.getUser.mockResolvedValue({ sub: 'user-1' });
    await profileHandler(mockEvent);
    expect(setHeaderMock).toHaveBeenCalledWith(mockEvent, 'Vary', 'Cookie');
  });

  it('sets the no-store header even when anonymous', async () => {
    mockAuth0Client.getUser.mockResolvedValue(undefined);
    await profileHandler(mockEvent);
    expect(setHeaderMock).toHaveBeenCalledWith(mockEvent, 'Cache-Control', 'no-store');
  });

  it('returns the user claims when authenticated', async () => {
    mockAuth0Client.getUser.mockResolvedValue({ sub: 'user-1', email: 'a@example.com' });
    const result = await profileHandler(mockEvent);
    expect(result).toEqual({ sub: 'user-1', email: 'a@example.com' });
  });

  it('returns null when anonymous', async () => {
    mockAuth0Client.getUser.mockResolvedValue(undefined);
    const result = await profileHandler(mockEvent);
    expect(result).toBeNull();
  });

  it('propagates a session-read failure instead of reporting nobody is signed in', async () => {
    // The failure must not surface as `null`: the client cannot tell that apart from an
    // anonymous caller, and would cache the wrong conclusion for the rest of the session.
    mockAuth0Client.getUser.mockRejectedValue(new Error('session store unavailable'));
    await expect(profileHandler(mockEvent)).rejects.toThrow('session store unavailable');
  });
});
