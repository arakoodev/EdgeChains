import test from 'node:test';
import assert from 'node:assert/strict';
import { QdrantRestClient } from './qdrant-client.ts';
import { AwsComprehendPiiRedactor } from './aws-comprehend-pii.ts';

test('QdrantRestClient creates collection, upserts points, and executes similarity search via direct REST API', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        result: url.endsWith('/points/search')
          ? [{ id: 1, score: 0.992, payload: { text: 'EdgeChains Qdrant doc' } }]
          : { operation_id: 1 },
      }),
    };
  };

  const qdrant = new QdrantRestClient({ url: 'http://localhost:6333', apiKey: 'qdrant_secret', fetchImpl });
  await qdrant.createCollection('docs', 3, 'Cosine');
  await qdrant.upsertPoints('docs', [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { text: 'EdgeChains Qdrant doc' } }]);
  const searchRes = await qdrant.searchPoints({ collectionName: 'docs', vector: [0.1, 0.2, 0.3], limit: 3 });

  assert.equal(calls.length, 3);
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[2].url, 'http://localhost:6333/collections/docs/points/search');
  assert.equal(searchRes.result[0].score, 0.992);
});

test('AwsComprehendPiiRedactor signs SigV4 request, redacts PII spans, and chains with LLM Endpoint', async () => {
  const rawPrompt = 'Contact Alice at alice@example.com orSSN 123-45-6789.';
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'https://comprehend.us-east-1.amazonaws.com/');
    assert.ok(init.headers.Authorization.startsWith('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/'));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        Entities: [
          { Type: 'NAME', Score: 0.99, BeginOffset: 8, EndOffset: 13 },
          { Type: 'EMAIL', Score: 0.99, BeginOffset: 17, EndOffset: 34 },
          { Type: 'SSN', Score: 0.98, BeginOffset: 41, EndOffset: 52 },
        ],
      }),
    };
  };

  const redactor = new AwsComprehendPiiRedactor({
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    fetchImpl,
  });

  const observed = [];
  redactor.onRedaction((evt) => observed.push(evt));

  const pipeline = redactor.chainWithEndpoint(async (safePrompt) => `LLM_REPLY_TO(${safePrompt})`);
  const out = await pipeline(rawPrompt);

  assert.equal(out.redactedPrompt, 'Contact [REDACTED_NAME] at [REDACTED_EMAIL] orSSN [REDACTED_SSN].');
  assert.equal(out.response, 'LLM_REPLY_TO(Contact [REDACTED_NAME] at [REDACTED_EMAIL] orSSN [REDACTED_SSN].)');
  assert.equal(observed.length, 1);
});
