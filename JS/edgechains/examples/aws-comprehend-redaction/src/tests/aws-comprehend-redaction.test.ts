import { test, expect } from "vitest";

test("should redact PII before sending prompt to LLM endpoint", async () => {
    const res = await fetch("http://localhost:3000/redact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            inquiry: "Hi, my name is Jane Doe, email jane.doe@example.com, SSN 123-45-6789. Where is my order?",
        }),
    });

    const data = await res.json();
    expect(data.redactedPrompt).toContain("[EMAIL]");
    expect(data.redactedPrompt).toContain("[SSN]");
    expect(data.redactedPrompt).not.toContain("123-45-6789");
}, 40000);
