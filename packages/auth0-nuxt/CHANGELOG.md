# Change Log

## [v1.0.0-beta.1](https://github.com/auth0/auth0-nuxt/tree/auth0-nuxt-v1.0.0-beta.1) (2025-01-21)
[Full Changelog](https://github.com/auth0/auth0-nuxt/compare/auth0-nuxt-v1.0.0-beta.0...auth0-nuxt-v1.0.0-beta.1)

**Fixed**
- fix(auth0-nuxt): do not use --stub to build [\#12](https://github.com/auth0/auth0-nuxt/pull/12) ([frederikprijck](https://github.com/frederikprijck))
- fix(auth0-nuxt): explicitly define dependencies [\#13](https://github.com/auth0/auth0-nuxt/pull/13) ([frederikprijck](https://github.com/frederikprijck))

## [v1.0.0-beta.0](https://github.com/auth0/auth0-nuxt/releases/tag/auth0-nuxt-v1.0.0-beta.0) (2025-10-16)

The `@auth0/auth0-nuxt` library enables user authentication in Nuxt applications.

The following features are included in v1.0.0-beta.0:

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