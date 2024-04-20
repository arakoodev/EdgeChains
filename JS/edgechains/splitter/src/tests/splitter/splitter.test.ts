import { TextSplitter } from "../../lib/text-splitter/textSplitter.js";

describe("TextSplitter", () => {
    it("should split text into chunks of the specified size", async () => {
        const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
        const chunkSize = 10; // Set the chunk size

        // Create an instance of TextSplitter
        const textSplitter = new TextSplitter();

        // Call the splitTextIntoChunks method with the text and chunk size
        const result = await textSplitter.splitTextIntoChunks(text, chunkSize);
        // Define the expected chunks
        const expectedChunks = [
            "Lorem ipsu",
            "m dolor si",
            "t amet, co",
            "nsectetur ",
            "adipiscing",
            " elit.",
        ];

        // Check if the result matches the expected chunks
        expect(result).toEqual(expectedChunks);
    });

    it("should handle empty text", async () => {
        const text = "";
        const chunkSize = 10;

        const textSplitter = new TextSplitter();

        const result = await textSplitter.splitTextIntoChunks(text, chunkSize);

        expect(result).toEqual([]);
    });

    it("should handle text shorter than chunk size", async () => {
        const text = "Short";
        const chunkSize = 10;

        const textSplitter = new TextSplitter();

        const result = await textSplitter.splitTextIntoChunks(text, chunkSize);

        expect(result).toEqual(["Short"]);
    });

    // Add more test cases as needed
});
