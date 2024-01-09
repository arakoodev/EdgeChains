// const reactChain = require("./ReactChain");

import { reactChain } from "./ReactChain";

// import { reactChain } from "./ReactChain";
// ^^^^^^

// SyntaxError: Cannot use import statement outside a module


describe("ReAct Chain", () => {
    it("should return a response", async () => {
        expect(
            await reactChain(
                "Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President?"
            )
        ).toContain("Bill Clinton");
    }, 30000);
});
