const Configuration = {
    extends: ["@commitlint/config-conventional"],
    // Ship's release commits use "Release <tag>", which isn't conventional.
    ignores: [(message) => /^Release /.test(message)],
    rules: {
        'scope-enum': [2, 'always', ['auth0-nuxt']],
    }
};

export default Configuration;