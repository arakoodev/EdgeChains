import { afterEach, describe, expect, it } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://qdrant.test";
const MOCK_QDRANT_API_KEY = "mock-api-key";

describe("Qdrant constructor / createClient", () => {
    afterEach(() => {
        delete process.env.QDRANT_URL;
        delete process.env.QDRANT_API_KEY;
    });

    it("supports the positional (url, apiKey) signature like Supabase", () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        expect(client.baseUrl).toBe(MOCK_QDRANT_URL);
        expect(client.apiKey).toBe(MOCK_QDRANT_API_KEY);
    });

    it("supports the options-object signature", () => {
        const qdrant = new Qdrant({
            url: MOCK_QDRANT_URL,
            apiKey: MOCK_QDRANT_API_KEY,
            collectionName: "docs",
            dimensions: 1536,
        });
        const client = qdrant.createClient();
        expect(client.baseUrl).toBe(MOCK_QDRANT_URL);
        expect(client.apiKey).toBe(MOCK_QDRANT_API_KEY);
        expect(qdrant.collectionName).toBe("docs");
        expect(qdrant.dimensions).toBe(1536);
    });

    it("strips trailing slashes from the base url", () => {
        const qdrant = new Qdrant("http://localhost:6333///", "k");
        expect(qdrant.createClient().baseUrl).toBe("http://localhost:6333");
    });

    it("falls back to QDRANT_URL / QDRANT_API_KEY env vars", () => {
        process.env.QDRANT_URL = "http://env-qdrant:6333";
        process.env.QDRANT_API_KEY = "env-key";
        const qdrant = new Qdrant();
        const client = qdrant.createClient();
        expect(client.baseUrl).toBe("http://env-qdrant:6333");
        expect(client.apiKey).toBe("env-key");
    });

    it("throws when no url is configured", () => {
        const qdrant = new Qdrant();
        expect(() => qdrant.createClient()).toThrow(/url is required/);
    });

    it("omits the api-key when none is configured", () => {
        const qdrant = new Qdrant("http://localhost:6333");
        expect(qdrant.createClient().apiKey).toBeUndefined();
    });
});
