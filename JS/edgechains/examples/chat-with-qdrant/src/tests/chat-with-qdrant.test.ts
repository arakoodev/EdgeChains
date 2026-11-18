import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "vitest";
import Jsonnet from "@arakoodev/jsonnet";
import { localEmbed } from "../lib/localEmbed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("jsonnet hyde template substitutes query and retrieved content", () => {
    const jsonnet = new Jsonnet();
    const prompts = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/prompts.jsonnet"))
    );
    const rendered = JSON.parse(
        jsonnet
            .extString("promptTemplate", prompts.ans_prompt_system)
            .extString("time", "")
            .extString("query", "Qdrant is a vector database")
            .evaluateFile(path.join(__dirname, "../../jsonnet/hyde.jsonnet"))
    );
    expect(rendered.prompt).toContain("Qdrant is a vector database");
    expect(rendered.prompt).toContain("Answer only from the retrieved sources");
});

test("jsonnet secrets expose qdrant_url and qdrant_api_key", () => {
    const jsonnet = new Jsonnet();
    const secrets = JSON.parse(
        jsonnet.evaluateFile(path.join(__dirname, "../../jsonnet/secrets.jsonnet"))
    );
    expect(secrets.qdrant_url).toBe("http://localhost:6333");
    expect(secrets).toHaveProperty("qdrant_api_key");
});

test("local embeddings are deterministic and unit-length", () => {
    const a = localEmbed("jsonnet prompts");
    const b = localEmbed("jsonnet prompts");
    const norm = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
    expect(a).toEqual(b);
    expect(norm).toBeCloseTo(1, 5);
});
