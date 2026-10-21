import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Router } from "../index.js";
import { createMockLLMServer, MockLLMServer } from "./helpers/mockLLMServer.js";

const MESSAGES = [{ role: "user", content: "hello" }];

describe("Router jsonnet configuration", () => {
    let mock: MockLLMServer;
    const tmpFiles: string[] = [];
    beforeAll(async () => {
        mock = await createMockLLMServer();
    });
    afterAll(async () => {
        await mock.close();
        for (const f of tmpFiles) fs.rmSync(f, { force: true });
    });

    function writeTempJsonnet(config: object): string {
        const file = path.join(
            os.tmpdir(),
            `edgechains-router-${Date.now()}-${Math.random()}.jsonnet`
        );
        fs.writeFileSync(file, JSON.stringify(config, null, 4));
        tmpFiles.push(file);
        return file;
    }

    it("loads a deployment list from a jsonnet file", async () => {
        const file = writeTempJsonnet({
            model_list: [
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "test-api-key",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
            ],
        });
        const router = Router.fromJsonnet(file);
        const res = await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        expect(res.choices[0].message.content).toBe("openai says hi");
    });

    it("evaluates via an injected @arakoodev/jsonnet-style evaluator", () => {
        // Simulates Jsonnet.evaluateFile output — a jsonnet doc evaluates to JSON.
        const evaluated = JSON.stringify({
            model_list: [
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "k",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
            ],
            fallbacks: { "gpt-4": ["gpt-3.5-turbo"] },
        });
        const fakeJsonnet = { evaluateFile: () => evaluated };
        const router = Router.fromJsonnet("any.jsonnet", fakeJsonnet);
        expect(router.getModelList("gpt-3.5-turbo")).toHaveLength(1);
    });

    it("rejects configs without a model_list", () => {
        const file = writeTempJsonnet({ routing_strategy: "least-tokens" });
        expect(() => Router.fromJsonnet(file)).toThrow(/model_list/);
    });
});
