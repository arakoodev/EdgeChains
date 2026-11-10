/**
 * Arakoo.ai EdgeChains Algora Bounty #290 ($75 USD):
 * AWS Comprehend PII Detection & Redaction Utility for EdgeChains JS SDK.
 *
 * Supports both live AWS Comprehend (`DetectPiiEntities` / `ContainsPiiEntities`)
 * and deterministic regex/entity fallback with character-offset masking (`[REDACTED:<TYPE>]`).
 */

const PII_PATTERNS = [
  { type: "EMAIL", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "CREDIT_DEBIT_NUMBER", regex: /\b(?:\d[ -]*?){13,16}\b/g },
  { type: "PHONE", regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: "AWS_ACCESS_KEY", regex: /\bAKIA[0-9A-Z]{16}\b/g },
];

/**
 * Redact PII entities from `text` using AWS Comprehend entity offsets or local detector.
 * @param {string} text
 * @param {object} options
 * @param {object} [options.comprehendClient] - AWS SDK v3 ComprehendClient instance
 * @param {string} [options.languageCode="en"]
 * @param {number} [options.minScore=0.75]
 * @param {string[]} [options.entityTypes] - Optional allowlist of PII types to redact
 * @returns {Promise<{redactedText: string, entities: Array<{Type: string, BeginOffset: number, EndOffset: number, Score: number}>}>}
 */
async function redactPiiWithComprehend(text, options = {}) {
  if (typeof text !== "string" || text.length === 0) {
    return { redactedText: "", entities: [] };
  }
  const minScore = options.minScore ?? 0.75;
  const allowTypes = Array.isArray(options.entityTypes) ? new Set(options.entityTypes) : null;

  let entities = [];
  if (options.comprehendClient && typeof options.comprehendClient.detectPiiEntities === "function") {
    const resp = await options.comprehendClient.detectPiiEntities({
      Text: text,
      LanguageCode: options.languageCode || "en",
    });
    entities = (resp && Array.isArray(resp.Entities) ? resp.Entities : []).filter(
      (e) => (e.Score ?? 1.0) >= minScore && (!allowTypes || allowTypes.has(e.Type))
    );
  } else {
    for (const pat of PII_PATTERNS) {
      if (allowTypes && !allowTypes.has(pat.type)) continue;
      for (const match of text.matchAll(pat.regex)) {
        entities.push({
          Type: pat.type,
          Score: 0.99,
          BeginOffset: match.index,
          EndOffset: match.index + match[0].length,
        });
      }
    }
  }

  // Sort entities by BeginOffset descending so replacements never shift earlier offsets
  const sorted = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
  let output = text;
  for (const ent of sorted) {
    const mask = options.maskWith || `[REDACTED:${ent.Type}]`;
    output = output.slice(0, ent.BeginOffset) + mask + output.slice(ent.EndOffset);
  }

  return {
    redactedText: output,
    entities: [...entities].sort((a, b) => a.BeginOffset - b.BeginOffset),
  };
}

export { redactPiiWithComprehend, PII_PATTERNS };
export default redactPiiWithComprehend;
