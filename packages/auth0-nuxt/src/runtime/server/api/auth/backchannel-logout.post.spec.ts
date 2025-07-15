import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readBody } from 'h3';
import backchannelLogoutHandler from './backchannel-logout.post';

vi.mock('h3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('h3')>()),
  readBody: vi.fn(),
  // Throw the error to be caught by expect().rejects
  createError: vi.fn((err) => {
    throw err;
  }),
}));

const mockAuth0Client = {
  handleBackchannelLogout: vi.fn(),
};

vi.mock('../../composables/use-auth0', () => ({
  useAuth0: vi.fn(() => mockAuth0Client),
}));

describe('backchannel-logout.post handler', () => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const mockEvent = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call handleBackchannelLogout with the logout_token', async () => {
    vi.mocked(readBody).mockResolvedValue({ logout_token: 'test-token' });
    await backchannelLogoutHandler(mockEvent);
    expect(mockAuth0Client.handleBackchannelLogout).toHaveBeenCalledWith('test-token');
  });

  it('should return null on success', async () => {
    vi.mocked(readBody).mockResolvedValue({ logout_token: 'test-token' });
    const result = await backchannelLogoutHandler(mockEvent);
    expect(result).toBeNull();
  });

  it('should throw a 400 error if logout_token is missing', async () => {
    vi.mocked(readBody).mockResolvedValue({}); // No logout_token
    await expect(backchannelLogoutHandler(mockEvent)).rejects.toEqual({
      statusCode: 400,
      statusMessage: 'Missing `logout_token` in the request body.',
    });
  });

  it('should throw a 400 error if handleBackchannelLogout fails', async () => {
    const errorMessage = 'Invalid token';
    vi.mocked(readBody).mockResolvedValue({ logout_token: 'test-token' });
    mockAuth0Client.handleBackchannelLogout.mockRejectedValueOnce(new Error(errorMessage));

    await expect(backchannelLogoutHandler(mockEvent)).rejects.toEqual({
      statusCode: 400,
      statusMessage: errorMessage,
    });
  });
});
