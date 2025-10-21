const Configuration = { 
    extends: ["@commitlint/config-conventional"],
    rules: {
        'scope-enum': [2, 'always', ['auth0-nuxt']],
    }
};

export default Configuration;