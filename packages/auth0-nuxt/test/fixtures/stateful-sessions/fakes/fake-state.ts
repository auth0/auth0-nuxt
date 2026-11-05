// The state of the fake Auth0. The plugin sets it, the test-only routes read it.

export const state = {
  /** Signs a JWT with the key of the fake Auth0 (set by the plugin). */
  sign: undefined as ((claims: Record<string, unknown>) => Promise<string>) | undefined,
};
