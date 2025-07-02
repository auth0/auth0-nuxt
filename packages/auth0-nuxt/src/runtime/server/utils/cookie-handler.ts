import type { CookieHandler, CookieSerializeOptions } from '~/src/store/cookie-handler';
import type { StoreOptions } from '~/src/types';
import { setCookie, deleteCookie, getCookie, parseCookies } from 'h3';

/**
 * A Nuxt-specific implementation of the CookieHandler interface.
 * This class provides methods to set, get, and delete cookies in a Nuxt application.
 * It uses the H3 event context to manage cookies effectively.
 */
export class NuxtCookieHandler implements CookieHandler {
  setCookie(storeOptions: StoreOptions, name: string, value: string, options?: CookieSerializeOptions): void {
    return setCookie(storeOptions.event, name, value, options);
  }
  getCookie(storeOptions: StoreOptions, name: string): string | undefined {
    return getCookie(storeOptions.event, name);
  }
  getCookies(storeOptions: StoreOptions): Record<string, string> {
    return parseCookies(storeOptions.event);
  }
  deleteCookie(storeOptions: StoreOptions, name: string): void {
    return deleteCookie(storeOptions.event, name);
  }
}