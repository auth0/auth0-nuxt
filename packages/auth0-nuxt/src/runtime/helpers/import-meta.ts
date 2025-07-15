/**
 * There seem to be no way to mock `import.meta` in Vitest, so we create a proxy here
 * that can be used in tests to determine if the code is running on the server or client.
 * 
 * @see https://github.com/nuxt/test-utils/discussions/884
 */
export const importMetaServer = import.meta.server;
export const importMetaClient = import.meta.client;