import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

vi.mock("axios", () => ({
  __esModule: true,
  default: {
    create: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockedAxios = vi.mocked(axios);

describe("Qdrant", () => {
  const request = vi.fn();

  beforeEach(() => {
    request.mockReset();
    mockedAxios.create.mockReturnValue({ request } as any);
    mockedAxios.isAxiosError.mockReturnValue(false);
  });

  it("creates a direct HTTP client with Qdrant headers", () => {
    const qdrant = new Qdrant("https://example-qdrant.test/", "mock-api-key");

    qdrant.createClient();

    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: "https://example-qdrant.test",
      headers: {
        "Content-Type": "application/json",
        "api-key": "mock-api-key",
      },
      timeout: 30000,
    });
  });

  it("upserts a single vector point", async () => {
    request.mockResolvedValue({
      data: { status: "ok", result: { operation_id: 1 } },
    });
    const qdrant = new Qdrant("https://example-qdrant.test", "mock-api-key");
    const client = qdrant.createClient();

    const result = await qdrant.insertVectorData({
      client,
      collectionName: "test_collection",
      id: "point-1",
      vector: [0.1, 0.2, 0.3],
      payload: { content: "hello" },
      wait: true,
    });

    expect(request).toHaveBeenCalledWith({
      method: "PUT",
      url: "/collections/test_collection/points",
      params: { wait: true },
      data: {
        points: [
          {
            id: "point-1",
            vector: [0.1, 0.2, 0.3],
            payload: { content: "hello" },
          },
        ],
      },
    });
    expect(result).toEqual({ status: "ok", result: { operation_id: 1 } });
  });

  it("queries points with a vector", async () => {
    request.mockResolvedValue({
      data: { status: "ok", result: [{ id: 1, score: 0.98 }] },
    });
    const qdrant = new Qdrant("https://example-qdrant.test", "mock-api-key");
    const client = qdrant.createClient();

    const result = await qdrant.getDataFromQuery({
      client,
      collectionName: "test_collection",
      query: [0.1, 0.2, 0.3],
      limit: 5,
      with_payload: true,
    });

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      url: "/collections/test_collection/points/query",
      params: undefined,
      data: {
        query: [0.1, 0.2, 0.3],
        limit: 5,
        with_payload: true,
      },
    });
    expect(result).toEqual([{ id: 1, score: 0.98 }]);
  });

  it("deletes a point by id", async () => {
    request.mockResolvedValue({
      data: { status: "ok", result: { operation_id: 2 } },
    });
    const qdrant = new Qdrant("https://example-qdrant.test", "mock-api-key");
    const client = qdrant.createClient();

    await qdrant.deleteById({
      client,
      collectionName: "test_collection",
      id: 42,
      wait: true,
    });

    expect(request).toHaveBeenCalledWith({
      method: "POST",
      url: "/collections/test_collection/points/delete",
      params: { wait: true },
      data: { points: [42] },
    });
  });
});
