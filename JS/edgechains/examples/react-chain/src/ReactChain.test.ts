import { reactChainCall} from "./ReactChain";
// const { reactChainCall } = require('./ReactChain');
describe("ReAct Chain", () => {
    it("should return a response", async () => {
        const response = await reactChainCall(
            "Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President?"
        );

        // Assuming the response is an object with a property 'answer'
        expect(response).toContain("Bill Clinton");
    }, 60000); // Increase the timeout to 60 seconds or as needed
});

