import { defineConfig } from "vitest/config";

// Vitest configuration for the EdgeChains JS package.
//
// `globals: true` lets the test suites use the same bare `describe`/`it`/`expect`
// globals that the repo's jest suites rely on, so a single test file runs under
// both runners without modification.
export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});