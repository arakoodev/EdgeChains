import { createServer, IncomingHttpHeaders, Server } from "node:http";
import { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Jsonnet from "@arakoodev/jsonnet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    GeminiAI,
    Palm2AI,
    type Palm2AIChatOptions,
    type Palm2AIRequest,
    type Palm2AIResponse,
} from "../../../index.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
function loadOptions(
    filename = path.join(directory, "prompts.jsonnet"),
): Palm2AIChatOptions {
    const jsonnet = new Jsonnet();
    try {
        return JSON.parse(jsonnet.evaluateFile(filename));
    } finally {
        jsonnet.destroy();
    }
}

describe("PaLM2 successor HTTP API", () => {
    let server: Server;
    let baseURL: string;
    let requests: {
        method?: string;
        url?: string;
        headers: IncomingHttpHeaders;
        body: Palm2AIRequest;
    }[];
    let statuses: number[];
    let response: Palm2AIResponse;

    beforeEach(async () => {
        requests = [];
        statuses = [];
        response = {
            candidates: [
                {
                    content: {
                        role: "model",
                        parts: [{ text: "Turtles are reptiles." }],
                    },
                    finishReason: "STOP",
                    index: 0,
                    safetyRatings: [],
                },
            ],
            usageMetadata: {
                promptTokenCount: 8,
                candidatesTokenCount: 4,
                totalTokenCount: 12,
            },
        };
        server = createServer(async (req, res) => {
            let body = "";
            for await (const chunk of req) body += chunk;
            requests.push({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: JSON.parse(body),
            });
            const status = statuses.shift() ?? 200;
            res.writeHead(status, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify(
                    status === 200
                        ? response
                        : { error: { message: "Unavailable" } },
                ),
            );
        });
        await new Promise<void>((resolve) =>
            server.listen(0, "127.0.0.1", resolve),
        );
        baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1beta`;
    });

    afterEach(async () => {
        vi.unstubAllEnvs();
        await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
        );
    });

    it("exports Palm2AI and sends Jsonnet options in the Google request body", async () => {
        vi.stubEnv("GEMINI_API_KEY", "unused-environment-key");
        expect(Palm2AI).toBe(GeminiAI);
        const options = loadOptions();
        const client = new Palm2AI({
            apiKey: "fixture-key",
            baseURL: baseURL + "/",
        });
        expect(await client.chat(options)).toEqual(response);
        expect(requests).toHaveLength(1);
        expect(requests[0]).toMatchObject({
            method: "POST",
            url: `/v1beta/models/${options.model}:generateContent`,
            headers: {
                "x-goog-api-key": "fixture-key",
                "content-type": "application/json",
            },
            body: {
                contents: [{ role: "user", parts: [{ text: options.prompt }] }],
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 64,
                    responseMimeType: "application/json",
                },
            },
        });
        expect(Object.keys(requests[0].body)).toEqual([
            "contents",
            "generationConfig",
        ]);
    });

    it("uses defaults and the environment key", async () => {
        vi.stubEnv("GEMINI_API_KEY", "environment-key");
        const client = new GeminiAI({ baseURL });
        await client.chat({ prompt: loadOptions().prompt });
        expect(requests[0].url).toBe(
            "/v1beta/models/gemini-3.5-flash-lite:generateContent",
        );
        expect(requests[0].headers["x-goog-api-key"]).toBe("environment-key");
        expect(requests[0].body.generationConfig).toEqual({
            temperature: 0.7,
            maxOutputTokens: 1024,
            responseMimeType: "text/plain",
        });
    });

    it("accepts a models/ prefix and returns blocked prompt feedback", async () => {
        response = { promptFeedback: { blockReason: "SAFETY" } };
        const options = loadOptions();
        expect(
            await new Palm2AI({ baseURL }).chat({
                ...options,
                model: `models/${options.model}`,
            }),
        ).toEqual(response);
        expect(requests[0].url).toBe(
            `/v1beta/models/${options.model}:generateContent`,
        );
    });

    it("retries failed HTTP requests and returns the successful response", async () => {
        statuses = [503, 200];
        const client = new Palm2AI({ baseURL });
        expect(
            await client.chat({ ...loadOptions(), max_retry: 2, delay: 0 }),
        ).toEqual(response);
        expect(requests).toHaveLength(2);
    });

    it("rejects after the requested number of attempts", async () => {
        statuses = [503, 503, 200];
        await expect(
            new Palm2AI({ baseURL }).chat({
                ...loadOptions(),
                max_retry: 2,
                delay: 0,
            }),
        ).rejects.toMatchObject({ response: { status: 503 } });
        expect(requests).toHaveLength(2);
    });

    it("sends the example's evaluated Jsonnet prompt to the HTTP API", async () => {
        const filename = path.resolve(
            directory,
            "../../../../../../../examples/palm2/jsonnet/main.jsonnet",
        );
        const options = loadOptions(filename);
        expect(await new Palm2AI({ baseURL }).chat(options)).toEqual(response);
        expect(requests[0].body.contents[0].parts[0].text).toBe(options.prompt);
    });
});
