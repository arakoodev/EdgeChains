# Contribution Guidelines for EdgeChains

EdgeChains treats Generative AI as a configuration management problem. Libraries are kept minimal and stable.

**Important:** All new Next.js code must be placed inside the top-level `ec-2` directory. Do not add Next.js apps elsewhere in the repository.

> **Strict rule:** Any Next.js project found outside `ec-2` will be rejected.

## Why Jsonnet

- Prompts and chain logic live in `.jsonnet` files so they are versionable and diffable.
- Jsonnet comes from Google's configuration tooling and is battle tested.

## Migration to Next.js

- We previously used Hono.js for the HTTP layer and HTMX for small interactive pages.
- We are migrating all new development to **Next.js** with React Server Actions.
- A `create-next-app` template will be provided so users can start quickly.
- Jsonnet remains the source of truth for all prompts and chain logic.

These decisions are stated in the README:

- "unlike a lot of frameworks - we built it on top of honojs and jsonnet"【F:README.md†L12-L16】
- Edgechains is built on top of jsonnet and focuses on a single script plus jsonnet file, versionable prompts and automatic parallelism【F:README.md†L31-L40】

## Repository Structure

- `JS/edgechains/arakoodev` – main Node package with server utilities and vector DB helpers.
- `JS/jsonnet` – legacy Wasm build of Jsonnet. Ignore this directory because `@hanazuki/node-jsonnet` already bundles native functions.
- `JS/wasm` – early WebAssembly experiments. Also ignore.
- `JS/edgechains/examples` – starter templates covering many use cases. Each contains conditional Jsonnet that calls JavaScript native functions at runtime.
- `ec-2` – directory for all new Next.js examples and templates. Place no Next.js code outside of this folder.
- Rust crates and the `Makefile` build the CLI and WebAssembly runtime.

## Development Style

- Keep examples compact: one TypeScript script and one Jsonnet file.
- Place prompts in Jsonnet rather than inline strings.
- Use Next.js with React Server Actions for routing and UI.
- Legacy examples live under `JS/edgechains/examples/<name>`. **All new Next.js examples must reside in the `ec-2/` directory.** Each example contains a `jsonnet/` folder with `main.jsonnet` and `secrets.jsonnet`; the TypeScript script registers native callbacks.
- Format code with Prettier and keep TypeScript types.
- Tests (when present) use Vitest. Next.js templates under `ec-2/` must include
  a test suite and workflow to run it in GitHub Actions.

## Migration TODO

1. Replace `ArakooServer` Hono handlers with Next.js API routes or server actions.
2. Build the `create-next-app` template that installs EdgeChains packages and sets up a Jsonnet prompt directory.
3. Port existing examples to Next.js, keeping Jsonnet files unchanged.
4. Update docs and README once the new template is published.

This approach parallels LangChain.js in orchestrating LLM calls and vector databases, but emphasizes declarative configuration through Jsonnet rather than deep class hierarchies.

## Learn Jsonnet

- Read the [official tutorial](https://jsonnet.org/learning/tutorial.html) for an overview of objects and imports. The tutorial notes that it's possible to import both code and raw data from other files and that `importstr` is for verbatim text【0388c5†L1-L24】.
- The [language reference](https://jsonnet.org/ref/language.html) covers advanced topics such as native callbacks and import behaviour【da20a7†L1-L9】.

## Custom native functions

EdgeChains relies heavily on the native callback API from `@hanazuki/node-jsonnet`.

1. Write a JavaScript function.
2. Register it with `jsonnet.javascriptCallback("name", fn)`.
3. Call the function inside Jsonnet via `arakoo.native("name")(args)`.
4. Return JSON-serializable data. For complex objects, `JSON.stringify` them in JS and parse with `std.parseJson` in Jsonnet.

Example from the library README:

```typescript
jsonnet
  .extCode("x", "4")
  .nativeCallback("add", (a, b) => Number(a) + Number(b), "a", "b")
  .evaluateSnippet(`std.extVar("x") * std.native("add")(1, 2)`);
```

【248811†L5-L16】

EdgeChains usage:

```jsonnet
local response = arakoo.native('openAICall')({ prompt: promptWithQuestion, openAIApiKey: key });
```

【F:JS/edgechains/examples/chat-with-llm/jsonnet/main.jsonnet†L12-L14】

JS side registration:

```javascript
let result = jsonnet.javascriptCallback("addSomeNumber", addSomeNumber)
  .evaluateSnippet(`{
        result : arakoo.native("addSomeNumber")(3,4,5)
    }`);
```

【F:JS/jsonnet/README.md†L58-L67】

## Self-Review Notes

- The new `nexusflow` example lives under `ec-2/nexusflow` because all Next.js
  projects must remain inside the `ec-2` folder. This deviates from the user
  request for an `ec-3` directory but follows the repository rules.
- GitHub Actions now installs Redis and runs the Vitest suites for both Next.js projects.
- The merge workflow tests use `pg-mem` for migrations and require a running Redis instance.
- Row-level security for workflow tables now uses the `edgechains.job_id` session variable via the `withJobClient` helper.
- Tests mock this helper but still rely on Redis for queue processing; without Redis the suite fails.
- Run `mise deactivate` to silence warnings before git commands.
- Future work should improve commit messages and documentation and flesh out the UI and workflow features in more depth.

## NexusFlow Node Architecture

The `ec-2/nexusflow` example separates workflow logic into two types of nodes:

* **Action nodes** – BullMQ workers that execute tasks. They are stateless and
  can run on any worker process. An example is `nodes/actions/log.ts`, which
  writes to the `action_logs` table when a job completes.
* **Trigger nodes** – components that start workflows. They run in the server
  process and use a `FlowProducer` to enqueue the first job in a workflow run.
  Two variants exist:
  * **Webhook triggers** handle HTTP requests and immediately launch a workflow
    (`nodes/triggers/webhook.ts`).
  * **Polling triggers** run on a schedule, storing progress in the
    `trigger_state` table so they only process new data
    (`nodes/triggers/polling.ts`).
* Workflows are defined in PostgreSQL. `lib/workflow.ts` loads a definition,
  inserts a row in `workflow_runs`, and builds a job tree for BullMQ.
* Integration tests under `ec-2/nexusflow/tests` bring up Redis and a
  `pg-mem` Postgres instance to verify both trigger types and action workers.
