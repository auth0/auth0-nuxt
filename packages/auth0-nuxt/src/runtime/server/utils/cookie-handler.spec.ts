import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setCookie, getCookie, parseCookies, deleteCookie } from 'h3';
import { NuxtCookieHandler } from '../utils/cookie-handler';
import type { H3Event } from 'h3';

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>();
  return {
    ...actual,
    setCookie: vi.fn(),
    getCookie: vi.fn(),
    parseCookies: vi.fn(),
    deleteCookie: vi.fn(),
  };
});

describe('NuxtCookieHandler', () => {
  let handler: NuxtCookieHandler;
  let mockEvent: H3Event;

  beforeEach(() => {
    handler = new NuxtCookieHandler();
    mockEvent = { node: { req: {}, res: {} } } as H3Event;
    vi.clearAllMocks();
  });

  it('setCookie calls h3 setCookie with correct parameters', () => {
    const options = { event: mockEvent };
    handler.setCookie('test-name', 'test-value', { maxAge: 3600 }, options);
    expect(setCookie).toHaveBeenCalledWith(mockEvent, 'test-name', 'test-value', { maxAge: 3600 });
  });

  it('getCookie calls h3 getCookie and returns value', () => {
    vi.mocked(getCookie).mockReturnValue('retrieved-value');
    const options = { event: mockEvent };
    const result = handler.getCookie('test-name', options);
    expect(getCookie).toHaveBeenCalledWith(mockEvent, 'test-name');
    expect(result).toBe('retrieved-value');
  });

  it('getCookies calls h3 parseCookies and returns values', () => {
    vi.mocked(parseCookies).mockReturnValue({ 'cookie1': 'value1' });
    const options = { event: mockEvent };
    const result = handler.getCookies(options);
    expect(parseCookies).toHaveBeenCalledWith(mockEvent);
    expect(result).toEqual({ 'cookie1': 'value1' });
  });

  it('deleteCookie calls h3 deleteCookie', () => {
    const options = { event: mockEvent };
    handler.deleteCookie('test-name', options);
    expect(deleteCookie).toHaveBeenCalledWith(mockEvent, 'test-name');
  });

  it('setCookie throws error if event is missing', () => {
    expect(() => handler.setCookie('test', 'value', {}, undefined)).toThrow('Store options with an event are required to set a cookie.');
  });
});