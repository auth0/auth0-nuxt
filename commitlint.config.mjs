const Configuration = {
    extends: ["@commitlint/config-conventional"],
    // Ship's release commits use "Release <tag>", which isn't conventional.
    ignores: [(message) => /^Release /.test(message)],
    rules: {
        // 'release' allows ship's conventional PR title: chore(release): <tag>.
        'scope-enum': [2, 'always', ['auth0-nuxt', 'release']],
    }
};

export default Configuration;