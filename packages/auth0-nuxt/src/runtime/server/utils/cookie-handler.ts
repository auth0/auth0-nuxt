import type { CookieHandler, CookieSerializeOptions } from '@auth0/auth0-server-js';
import { setCookie, deleteCookie, getCookie, parseCookies, H3Event } from 'h3';

export interface StoreOptions {
  event: H3Event
}
/**
 * A Nuxt-specific implementation of the CookieHandler interface.
 * This class provides methods to set, get, and delete cookies in a Nuxt application.
 * It uses the H3 event context to manage cookies effectively.
 */
export class NuxtCookieHandler implements CookieHandler<StoreOptions> {
  setCookie(name: string, value: string, options?: CookieSerializeOptions, storeOptions?: StoreOptions): void {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to set a cookie.');
    }

    return setCookie(storeOptions.event, name, value, options);
  }
  getCookie(name: string, storeOptions?: StoreOptions): string | undefined {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to set a cookie.');
    }

    return getCookie(storeOptions.event, name);
  }
  getCookies(storeOptions?: StoreOptions): Record<string, string> {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to set a cookie.');
    }

    return parseCookies(storeOptions.event);
  }
  deleteCookie(name: string, storeOptions?: StoreOptions): void {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to set a cookie.');
    }
    
    return deleteCookie(storeOptions.event, name);
  }
}
