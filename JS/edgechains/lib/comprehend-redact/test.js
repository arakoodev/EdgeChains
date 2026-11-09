import assert from "node:assert";
import { redactPiiWithComprehend } from "./index.js";

const mockClient = {
  async detectPiiEntities({ Text }) {
    const idx = Text.indexOf("alice@example.com");
    return {
      Entities: [
        { Type: "EMAIL", Score: 0.99, BeginOffset: idx, EndOffset: idx + "alice@example.com".length },
      ],
    };
  },
};

const res1 = await redactPiiWithComprehend("Contact alice@example.com for access.", {
  comprehendClient: mockClient,
});
assert.strictEqual(res1.redactedText, "Contact [REDACTED:EMAIL] for access.");
assert.strictEqual(res1.entities.length, 1);

const raw = "User SSN 123-45-6789, email bob@corp.io, key AKIAIOSFODNN7EXAMPLE";
const res2 = await redactPiiWithComprehend(raw);
assert(res2.redactedText.includes("[REDACTED:SSN]"));
assert(res2.redactedText.includes("[REDACTED:EMAIL]"));
assert(res2.redactedText.includes("[REDACTED:AWS_ACCESS_KEY]"));
assert(!res2.redactedText.includes("123-45-6789"));
console.log("JS/edgechains/lib/comprehend-redact/test.js: ALL ESM TESTS PASSED");
