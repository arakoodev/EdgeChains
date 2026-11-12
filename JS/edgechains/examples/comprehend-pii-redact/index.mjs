/**
 * Example: chain PII redaction before sending a prompt to an LLM.
 *
 * Without AWS credentials, uses a local detector stub.
 * With AWS credentials + @aws-sdk/client-comprehend, swap to default Comprehend.
 *
 * Run from repo root:
 *   node JS/edgechains/examples/comprehend-pii-redact/index.mjs
 */

// Inline minimal redactor mirror for zero-deps demo (mirrors production class API)
function applyRedactions(text, entities) {
  const sorted = entities.slice().sort((a, b) => b.BeginOffset - a.BeginOffset);
  let result = text;
  for (const e of sorted) {
    const label = `[REDACTED_${e.Type.toUpperCase()}]`;
    result = result.slice(0, e.BeginOffset) + label + result.slice(e.EndOffset);
  }
  return result;
}

async function demoDetect(text) {
  // Demo detector: flag simple email/phone patterns
  const entities = [];
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) {
    const i = text.indexOf(email[0]);
    entities.push({ Type: "EMAIL", BeginOffset: i, EndOffset: i + email[0].length, Score: 0.99 });
  }
  const phone = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
  if (phone) {
    const i = text.indexOf(phone[0]);
    entities.push({ Type: "PHONE", BeginOffset: i, EndOffset: i + phone[0].length, Score: 0.99 });
  }
  return entities;
}

const prompt = "Email me at ada@example.com or call 555-123-4567 about the invoice.";
const entities = await demoDetect(prompt);
const clean = applyRedactions(prompt, entities);

console.log("original:", prompt);
console.log("redacted:", clean);
console.log("done — wire ComprehendPiiRedactor from @arakoodev ai package for production.");
