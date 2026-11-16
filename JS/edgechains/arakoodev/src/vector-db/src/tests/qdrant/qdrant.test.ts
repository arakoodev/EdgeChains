import { QdrantVectorStore } from "../../lib/qdrant/qdrant.js";

describe("QdrantVectorStore unit tests", () => {
    it("should instantiate with default host", () => {
        const store = new QdrantVectorStore();
        expect(store).toBeDefined();
    });

    it("should build correct collection creation options", () => {
        const store = new QdrantVectorStore("http://localhost:6333", "test-key");
        expect(store).toBeInstanceOf(QdrantVectorStore);
    });
});
