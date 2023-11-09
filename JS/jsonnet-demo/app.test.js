import { test, beforeEach, afterEach } from "tap";
import { parseJsonnet } from "./app.js";

test("Parse Jsonnet", async ({ same, end }) => {
    const result = await parseJsonnet();
    same(result, {
        context: "",
        history: "Chat History: ",
        maxTokens: 100,
        preset:
            "You will be given context that may or may not be related to the question. If the context is related to the question, use it to answer the question.\n" +
            " Otherwise, say that you don't know the answer, and attempt to answer it anyways using an 'In General' format\n" +
            " Follow Up Input: {question}\n" +
            " Context: {context}\n" +
            " Chat History: {chat_history}\n",
        prompt:
            "Question: \n" +
            "You will be given context that may or may not be related to the question. If the context ",
        query: "Question: ",
        topK: 5,
    });
    end;
});
