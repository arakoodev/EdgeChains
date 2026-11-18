import { describe, it, expect, beforeEach } from "vitest"
import { InMemoryTokenStore } from "../core/TokenTracker.js"

describe("InMemoryTokenStore", () => {
  let store: InMemoryTokenStore

  beforeEach(() => {
    store = new InMemoryTokenStore(60_000)
  })

  it("should start with zero usage for unknown deployments", () => {
    const usage = store.getUsage("deploy-1")
    expect(usage.totalTokens).toBe(0)
    expect(usage.requestCount).toBe(0)
  })

  it("should increment token count", () => {
    store.increment("deploy-1", 100)
    const usage = store.getUsage("deploy-1")
    expect(usage.totalTokens).toBe(100)
    expect(usage.requestCount).toBe(1)
  })

  it("should accumulate multiple increments", () => {
    store.increment("deploy-1", 50)
    store.increment("deploy-1", 75)
    store.increment("deploy-1", 25)

    const usage = store.getUsage("deploy-1")
    expect(usage.totalTokens).toBe(150)
    expect(usage.requestCount).toBe(3)
  })

  it("should isolate deployments from each other", () => {
    store.increment("deploy-1", 200)
    store.increment("deploy-2", 400)

    expect(store.getUsage("deploy-1").totalTokens).toBe(200)
    expect(store.getUsage("deploy-2").totalTokens).toBe(400)
  })

  it("should start a new window after window ms elapses", () => {
    // Use a short window for testing
    const shortStore = new InMemoryTokenStore(100)

    shortStore.increment("deploy-1", 100)
    expect(shortStore.getUsage("deploy-1").totalTokens).toBe(100)

    // After waiting, the window resets
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        shortStore.increment("deploy-1", 50)
        // After window reset + new increment, total should be 50
        expect(shortStore.getUsage("deploy-1").totalTokens).toBe(50)
        resolve()
      }, 150)
    })
  })

  it("should return all usage via getAllUsage", () => {
    store.increment("deploy-1", 100)
    store.increment("deploy-2", 200)

    const all = store.getAllUsage()
    expect(Object.keys(all)).toHaveLength(2)
    expect(all["deploy-1"].totalTokens).toBe(100)
    expect(all["deploy-2"].totalTokens).toBe(200)
  })

  it("should clear all data on resetWindow", () => {
    store.increment("deploy-1", 100)
    store.resetWindow()

    expect(store.getUsage("deploy-1").totalTokens).toBe(0)
  })
})