# Change Log

## [v1.0.0-beta.0](https://github.com/auth0/auth0-nuxt/releases/tag/auth0-nuxt-v1.0.0-beta.0) (2025-10-16)

The `@auth0/auth0-nuxt` library enables user authentication in Nuxt applications.

Version 1.0.0-beta.0 includes the following features:

- Automatic route handling for authentication flows:
  - `GET /auth/login`
  - `GET /auth/callback`
  - `GET /auth/logout`
  - `POST /auth/backchannel-logout`
- The SDK uses stateless token storage by default, but supports stateful storage through the `sessionStoreFactoryPath` configuration option.
- In stateless storage mode, the SDK will use cookie-chunking to store the token in the browser's cookies.
- Access the underlying `ServerClient` (from `@auth0/auth0-server-js`) instance via the server-side `useAuth0()` composable for advanced use cases.
- Retrieving user information on the client can be achieved using the client-side `useUser()` composable.

For more information on how to configure the SDK and use its features, please refer to the [README](./README.md) or the [EXAMPLES](./EXAMPLES.md).

As with any beta release, we look forward to your questions and feedback to help us improve the library.