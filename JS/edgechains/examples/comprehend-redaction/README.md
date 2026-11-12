# Comprehend PII Redaction — EdgeChains example

Working example for [issue #290](https://github.com/arakoodev/EdgeChains/issues/290):
PII redaction on the EdgeChains SDK, backed by **Amazon Comprehend**
`DetectPiiEntities`.

The example drives `ComprehendRedact` (`arakoodev/src/ai/src/lib/comprehend-redaction/redact.ts`),
which signs each request with a self-contained **SigV4** implementation and calls
Comprehend over HTTPS with **no AWS SDK dependency** (the only runtime dep is `axios`).

It demonstrates the main integration shapes of the lib:

1. `redactText(text, "TAG")` — the default mode: each PII span is replaced by a
   bracketed entity type, e.g. `[EMAIL]`, `[PHONE]`.
2. `redactText(text, "MASK")` — each PII span is replaced by `*****`.
3. `redactObservable(text, mode?)` — an observable-shaped entry point (thenable,
   `subscribe`, async iterator) around the same redaction.
4. `chainWithEndpoint(endpoint, prompt, opts?)` — the `prompt` is redacted first,
   then the redacted text is forwarded to `endpoint.chat()`. The endpoint only ever
   sees the redacted prompt, and the call returns the endpoint's result unchanged
   (PII is **not** restored on the way back; map it yourself if you need the raw
   text).

## Run modes

The example is **bimodal** — the same code path runs against the local stub or the
live AWS service, selected by your environment:

| Mode                     | When                                                                   | What happens                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **LOCAL MOCK** (default) | no AWS credentials set, or `MOCK=1`                                    | a tiny in-process Comprehend stub answers `DetectPiiEntities`; zero config, no network, no AWS account needed |
| **REAL AWS**             | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` set (and `MOCK` not `1`) | the request is SigV4-signed and sent to the live `https://comprehend.<region>.amazonaws.com/` service         |

## Prerequisites

The lib resolves `axios` from the `@arakoodev/edgechains.js` package, so install the
package's dependencies once (this also provides everything the lib imports):

```bash
# run from the repo root; the subshell keeps you there, so the commands in
# "Run" below work exactly as written
(cd JS/edgechains/arakoodev && npm install)
```

The example itself is run with `tsx` (not a declared dependency of the example); use
`npx tsx` or a globally installed `tsx`.

## Run

All commands below run **from the repo root**.

Local mock (zero configuration):

```bash
npx tsx JS/edgechains/examples/comprehend-redaction/src/index.ts
```

Real Amazon Comprehend:

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
# optional:
export AWS_SESSION_TOKEN=...      # only for temporary/STS credentials
export AWS_REGION=us-east-1       # defaults to us-east-1
export COMPREHEND_ENDPOINT=...    # optional, e.g. a VPC endpoint
npx tsx JS/edgechains/examples/comprehend-redaction/src/index.ts
```

The header line `[mode] LOCAL Comprehend mock …` or `[mode] REAL Amazon Comprehend …`
tells you which path is active.

> The IAM principal needs `comprehend:DetectPiiEntities`. `DetectPiiEntities` is a
> synchronous, pay-per-request API — for high volume, prefer the async
> `StartPiiEntitiesAnalysis` job APIs (not used here).

## Expected output (mock mode)

Actual output of `npx tsx JS/edgechains/examples/comprehend-redaction/src/index.ts`
with no AWS credentials (local mock):

```
[mode] LOCAL Comprehend mock — set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY to use the real service
[1] Prompt original:   Please summarize this note from jane.doe@example.com, her cell is 415-555-0132.
[2] Redacted (TAG):    Please summarize this note from [EMAIL], her cell is [PHONE].
[3] Redacted (MASK):   Please summarize this note from *****, her cell is *****.
[4] Observable:        Please summarize this note from [EMAIL], her cell is [PHONE].
[5] Endpoint.chat received: Please summarize this note from *****, her cell is *****.
[6] Endpoint result:   { content: 'Summarized with PII already redacted.' }
```

In real-AWS mode the same steps run, but the PII spans come from the actual
`DetectPiiEntities` response (real offsets, entity types, per-entity `Score`), and
the `[6]` step returns whatever your wired `endpoint.chat` produces — the
`chainWithEndpoint` call itself never re-inserts the original PII.

## Tests

The lib's unit tests live in
`arakoodev/src/ai/src/tests/comprehend-redaction.test.ts` and mock `axios` to mirror
the real `DetectPiiEntities` response shape (`Entities`, not `Result`).
