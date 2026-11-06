import { test, expect } from "vitest";
import fs from "fs";
import path from "path";

const testPrompts = JSON.parse(fs.readFileSync(path.join(__dirname, "../../jsonnet/testPrompts.jsonnet"), "utf8"));

test("should return expected answer from PaLM 2 using Jsonnet prompt", async () => {
    const query = encodeURIComponent(testPrompts.sampleQuestion);
    const res = await fetch(`http://localhost:5000?question=${query}`);
    const data = await res.json();
    expect(data).toContain("Canberra");
}, 40000);
