import type { StoreOptions } from "../types";

/**
 * Options for serializing cookies.
 * These options are used when setting cookies in the store.
 */
export interface CookieSerializeOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  partitioned?: boolean;
  priority?: "low" | "medium" | "high";
}

/**
 * Interface for handling cookies in a store.
 * Implementations of this interface should handle the specifics of cookie management.
 */
export interface CookieHandler {
  setCookie: (
    storeOptions: StoreOptions,
    name: string,
    value: string,
    options?: CookieSerializeOptions,
  ) => void;
  getCookie: (storeOptions: StoreOptions, name: string) => string | undefined;
  getCookies: (storeOptions: StoreOptions) => Record<string, string>;
  deleteCookie: (storeOptions: StoreOptions, name: string) => void;
}