module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
    },
    extends: "google",
    overrides: [
        {
            env: {
                node: true,
            },
            files: [".eslintrc.{js,cjs}"],
            parserOptions: {
                sourceType: "script",
            },
        },
    ],
    parserOptions: {
        ecmaVersion: "latest",
    },
    rules: {
            'array-callback-return': 'error',
    'no-undef': 'off',
    'no-empty': 'off',
    'no-func-assign': 'off',
    'no-cond-assign': 'off',
    'no-constant-binary-expression': 'error',
    'no-constructor-return': 'error'
    },
};
