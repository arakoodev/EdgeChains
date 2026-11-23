/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    // The codebase uses NodeNext-style `.js` import specifiers that point at
    // `.ts` source files. Map them so jest can resolve the TypeScript sources.
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    testMatch: ["**/tests/**/*.test.ts"],
};