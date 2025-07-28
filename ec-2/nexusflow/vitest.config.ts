import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 10000,
    threads: false,
    sequence: {
      concurrent: false,
    },
  },
});
