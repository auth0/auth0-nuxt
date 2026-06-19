import { describe, it, expect } from 'vitest';
import { isSharedCacheable } from './is-shared-cacheable';

describe('isSharedCacheable', () => {
  it('returns true when route rules are undefined (fail closed)', () => {
    expect(isSharedCacheable(undefined)).toBe(true);
  });

  it('returns true when cache route rule is set', () => {
    expect(isSharedCacheable({ cache: { maxAge: 60 } } as never)).toBe(true);
  });

  it('returns true when swr route rule is set', () => {
    expect(isSharedCacheable({ swr: true } as never)).toBe(true);
  });

  it('returns true when isr route rule is set', () => {
    expect(isSharedCacheable({ isr: true } as never)).toBe(true);
  });

  it('returns true for Cache-Control: public header', () => {
    expect(isSharedCacheable({ headers: { 'Cache-Control': 'public, max-age=600' } } as never)).toBe(true);
  });

  it('returns true for s-maxage header', () => {
    expect(isSharedCacheable({ headers: { 'cache-control': 'max-age=0, s-maxage=900' } } as never)).toBe(true);
  });

  it('matches the header key case-insensitively', () => {
    expect(isSharedCacheable({ headers: { 'CACHE-CONTROL': 'public' } } as never)).toBe(true);
  });

  it('returns false for private max-age only', () => {
    expect(isSharedCacheable({ headers: { 'Cache-Control': 'max-age=600' } } as never)).toBe(false);
  });

  it('returns false for no-store', () => {
    expect(isSharedCacheable({ headers: { 'Cache-Control': 'no-store' } } as never)).toBe(false);
  });

  it('returns false for empty route rules', () => {
    expect(isSharedCacheable({} as never)).toBe(false);
  });
});
