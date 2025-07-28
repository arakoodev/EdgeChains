import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 10000,
    // @ts-expect-error - property not in type but supported by vitest
    threads: false,
    sequence: {
      concurrent: false,
    },
  },
});
