// Import the reactChainCall function from the ReactChain module
import { reactChainCall } from "./ReactChain";

// Describe block for the ReAct Chain test suite
describe("ReAct Chain", () => {
    // Test case: It should return a response
    it("should return a response", async () => {
        // Call the reactChainCall function with a sample question
        const response = await reactChainCall(
            "Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President?"
        );

        // Assuming the response is an object with a property 'answer'
        expect(response).toContain("Bill Clinton");
    }, 60000); // Increase the timeout to 60 seconds or as needed
});
