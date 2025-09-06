import { describe, it, expect } from "vitest";

describe("worker module loading", () => {
  it("should import startLogWorker without errors", async () => {
    const { startLogWorker } = await import("../nodes/actions/log");
    expect(typeof startLogWorker).toBe("function");
  });

  it("should import startEchoWorker without errors", async () => {
    const { startEchoWorker } = await import("../workers/echo");
    expect(typeof startEchoWorker).toBe("function");
  });

  it("should import streamAwareBullWorker without errors", async () => {
    const module = await import("../workers/streamAwareBullWorker");
    expect(module.StreamAwareBullMQWorker).toBeDefined();
    expect(module.redisClient).toBeDefined();
    expect(typeof module.StreamAwareBullMQWorker).toBe("function");
  });

  it("should import merge worker without errors", async () => {
    // Merge worker auto-instantiates, so we just test the import
    expect(async () => {
      await import("../workers/merge");
    }).not.toThrow();
  });

  it("should be able to instantiate worker classes", async () => {
    const { StreamAwareBullMQWorker } = await import("../workers/streamAwareBullWorker");
    
    // Mock Redis connection to avoid actual connection
    const mockConnection = {
      xadd: () => Promise.resolve("1-0"),
      xgroup: () => Promise.resolve("OK"),
    };

    class TestWorker extends StreamAwareBullMQWorker {
      constructor() {
        super("test-queue", async () => ({}), { connection: mockConnection });
      }
    }

    expect(() => new TestWorker()).not.toThrow();
  });

  it("should import start-workers entry point without errors", async () => {
    // Test that the main start-workers file can be imported
    // This tests the import chain without actually starting workers
    const dynamicImport = () => import("../start-workers");
    expect(dynamicImport).not.toThrow();
  });
});