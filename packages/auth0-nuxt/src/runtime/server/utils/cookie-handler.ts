import type { CookieHandler, CookieSerializeOptions } from '@auth0/auth0-server-js';
import { setCookie, deleteCookie, getCookie, parseCookies } from 'h3';
import type { StoreOptions } from '~/src/types';

/**
 * A Nuxt-specific implementation of the CookieHandler interface.
 * This class provides methods to set, get, and delete cookies in a Nuxt application.
 * It uses the H3 event context to manage cookies effectively with enhanced security.
 */
export class NuxtCookieHandler implements CookieHandler<StoreOptions> {
  /**
   * Sets a cookie with the given name and value.
   * @param name The name of the cookie to set.
   * @param value The value of the cookie to set.
   * @param options The options for the cookie, such as expiration, path, domain, etc.
   * @param storeOptions The options for the store, which must include an H3Event context.
   * @throws Will throw an error if storeOptions does not include an event.
   */
  setCookie(name: string, value: string, options?: CookieSerializeOptions, storeOptions?: StoreOptions): void {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to set a cookie.');
    }

    return setCookie(storeOptions.event, name, value, options);
  }

  /**
   * Retrieves the value of a cookie by its name.
   * @param name The name of the cookie to retrieve.
   * @param storeOptions The options for the store, which must include an H3Event context.
   * @returns The value of the cookie if it exists, or undefined if it does not.
   * @throws Will throw an error if storeOptions does not include an event.
   */
  getCookie(name: string, storeOptions?: StoreOptions): string | undefined {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to get a cookie.');
    }

    return getCookie(storeOptions.event, name);
  }

  /**
   * Retrieves all cookies as an object of key-value pairs.
   * @param storeOptions The options for the store, which must include an H3Event context.
   * @returns An object containing all cookies as key-value pairs.
   * @throws Will throw an error if storeOptions does not include an event.
   */
  getCookies(storeOptions?: StoreOptions): Record<string, string> {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to get cookies.');
    }

    return parseCookies(storeOptions.event);
  }

  /**
   * Deletes a cookie by its name.
   * @param name The name of the cookie to delete.
   * @param storeOptions The options for the store, which must include an H3Event context.
   */
  deleteCookie(name: string, storeOptions?: StoreOptions): void {
    if (!storeOptions?.event) {
      throw new Error('Store options with an event are required to delete a cookie.');
    }
    
    return deleteCookie(storeOptions.event, name);
  }
}
