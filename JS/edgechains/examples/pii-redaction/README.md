# Redact a prompt before calling an endpoint

This example addresses EdgeChains #290. It uses a real RxJS pipeline and the
existing `OpenAI.chat` method. Node 20+ is required by the AWS SDK dependency.

From `JS/edgechains/arakoodev`:

```sh
npm install
npm run build
npx vitest run src/redaction/src/redaction.test.ts
node ../examples/pii-redaction/demo.mjs
```

The default example is **offline**: the official AWS SDK signs and sends a
DetectPiiEntities request to a localhost HTTP fixture, and an Axios adapter
checks what the existing OpenAI class would send. No AWS credentials, cloud
account or paid call is needed. The fixed entities and model reply are synthetic;
this run does not measure Amazon's detection accuracy.

## Using the module

```ts
import { of, firstValueFrom } from "rxjs";
import { ComprehendRedactor } from "@arakoodev/edgechains.js/redaction";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

const redactor = new ComprehendRedactor({ region: "us-east-1" });
const model = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
try {
  const reply = await firstValueFrom(
      of({ prompt: "Please greet Jane; use jane@example.test." }).pipe(
          redactor.protect(options => model.chat(options))
      )
  );
} finally {
  redactor.destroy();
}
```

`protect` takes a bound function or arrow function returning a Promise or
Observable, so it also works with the existing Gemini/Llama chat methods. It
redacts `prompt` and every `messages[].content`, leaving the caller's object
unchanged. All these fields must be plain text. Images and structured message
content are rejected. Text and message objects are copied before detection starts,
so changes to the caller's input while a request is pending do not bypass redaction.
Fields outside those two paths are not inspected: do not
put secrets in model options, names, tool arguments or other metadata.

`redact(text, signal?)` returns a Promise. `redact$(text)` is a cold Observable;
`redactOperator()` chains a stream of plain strings. Work begins on subscription,
each input is processed sequentially, and a new subscription makes new requests.
Unsubscribe aborts in-flight detection and prevents a downstream call that has
not yet started. It cannot undo an endpoint request already sent.

Call `destroy()` when finished to abort pending detection and release the SDK
connections created by this instance. It is safe to call more than once. An
injected client remains owned by its caller and is not destroyed. A destroyed
redactor cannot be reused; already-started downstream calls cannot be recalled.

## Live validation

The sample can also call real AWS Comprehend and OpenAI with the same synthetic
prompt. This **can incur charges**. Configure authorized credentials outside the
repository using the AWS SDK's standard provider chain and `OPENAI_API_KEY`.
Only run after approving API costs:

```sh
ALLOW_PAID_API_CALLS=yes node ../examples/pii-redaction/demo.mjs --live
```

Live detection/model execution and the issue's requested Loom recording have
not been performed as part of the offline verification. A fixture demonstration
is not a substitute for those acceptance steps.

## Detection behavior and limits

- English and Spanish input; at most 100,000 UTF-8 bytes per text field. Oversize
  inputs fail before a request rather than splitting a possible entity across
  chunk boundaries. Empty strings pass without a call.
- The original text is sent to AWS for detection. Only the redacted text goes to
  the downstream endpoint. Comprehend is probabilistic and may miss PII: this is
  not a guarantee that the output is free of personal data.
- All returned ranges are masked, regardless of confidence or entity type.
  Overlapping/adjacent ranges are merged and replaced with `[REDACTED]`.
  Character offsets are mapped across Unicode code points, including emoji;
  malformed ranges, malformed responses and unpaired surrogates stop the chain.
- Errors and timeout stop the chain; raw SDK errors are neither logged nor
  attached as causes, because they may include input text. Default timeout is
  30 seconds; configured delays must be integers from 1 to 2,147,483,647 ms.
  The internally created SDK client has retries disabled; an injected
  client owns its retry configuration and lifecycle.

References: [DetectPiiEntities](https://docs.aws.amazon.com/comprehend/latest/APIReference/API_DetectPiiEntities.html),
[PII offsets](https://docs.aws.amazon.com/comprehend/latest/APIReference/API_PiiEntity.html),
[AWS detection example](https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/).
