import http from "http";
import { AddressInfo } from "net";
import {
  PaLM2Client,
  PALM2_DEFAULT_TEXT_MODEL,
  PALM2_DEFAULT_CHAT_MODEL,
  type PaLM2Response,
  type PaLM2MessageCandidate,
  type PaLM2TextCandidate,
} from "../../../lib/palm2/palm2.js";
import { loadPrompts } from "./prompts.js";

/**
 * Fixture-backed tests: stand up a real local HTTP api and run the client
 * against it, asserting the requests that hit the wire and the responses the
 * client maps. Prompts come from prompts.jsonnet, nothing is hardcoded.
 */

const prompts = loadPrompts();

interface CapturedRequest {
  method: string;
  url: string;
  body: any;
}

let server: http.Server;
let baseUrl: string;
let captured: CapturedRequest[];

function startServer(
  respond: (req: CapturedRequest) => { status?: number; body: unknown },
): Promise<void> {
  captured = [];
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const entry: CapturedRequest = {
        method: req.method ?? "",
        url: req.url ?? "",
        body: raw ? JSON.parse(raw) : undefined,
      };
      captured.push(entry);
      const { status = 200, body } = respond(entry);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe("PaLM2Client against a local HTTP api", () => {
  afterEach(async () => {
    await stopServer();
  });

  test("generateText sends the documented generateText request and maps the candidate", async () => {
    await startServer(() => ({
      body: {
        candidates: [
          {
            output: "Paris is the capital of France.",
            safetyRatings: [
              {
                category: "HARM_CATEGORY_DEROGATORY",
                probability: "NEGLIGIBLE",
              },
            ],
          },
        ],
      },
    }));

    const client = new PaLM2Client({ apiKey: "fixture-key", baseUrl });
    const response = await client.generateText(prompts.text_prompt, {
      temperature: 0.25,
      maxOutputTokens: 40,
      candidateCount: 1,
    });

    expect(captured).toHaveLength(1);
    const request = captured[0];
    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      `/models/${PALM2_DEFAULT_TEXT_MODEL}:generateText?key=fixture-key`,
    );
    expect(request.body).toEqual({
      prompt: { text: prompts.text_prompt },
      temperature: 0.25,
      candidateCount: 1,
      maxOutputTokens: 40,
      topK: undefined,
      topP: undefined,
      stopSequences: undefined,
    });

    const typed = response as PaLM2Response<PaLM2TextCandidate>;
    expect(typed.candidates).toHaveLength(1);
    expect(typed.candidates[0].output).toBe("Paris is the capital of France.");
    expect(typed.candidates[0].safetyRatings[0].probability).toBe("NEGLIGIBLE");
  });

  test("generateMessage sends messages in order and maps the candidate", async () => {
    await startServer(() => ({
      body: {
        candidates: [
          {
            content: "It is 42.",
            author: "1",
            safetyRatings: [],
          },
        ],
      },
    }));

    const client = new PaLM2Client({ apiKey: "fixture-key", baseUrl });
    const response = await client.generateMessage(prompts.chat_messages, {
      temperature: 0.5,
    });

    expect(captured).toHaveLength(1);
    const request = captured[0];
    expect(request.url).toBe(
      `/models/${PALM2_DEFAULT_CHAT_MODEL}:generateMessage?key=fixture-key`,
    );
    expect(request.body.prompt.messages).toEqual(prompts.chat_messages);
    expect(request.body.temperature).toBe(0.5);

    const typed = response as PaLM2Response<PaLM2MessageCandidate>;
    expect(typed.candidates[0].content).toBe("It is 42.");
    expect(typed.candidates[0].author).toBe("1");
  });

  test("bubbles up api errors from the local server", async () => {
    await startServer(() => ({
      status: 400,
      body: {
        error: {
          code: 400,
          message: "API key not valid. Please pass a valid token.",
        },
      },
    }));

    const client = new PaLM2Client({ apiKey: "bad-key", baseUrl });

    await expect(client.generateText(prompts.text_prompt)).rejects.toThrow();
    expect(captured).toHaveLength(1);
  });

  test("honors a per-call model override on the wire", async () => {
    await startServer(() => ({
      body: { candidates: [{ output: "ok", safetyRatings: [] }] },
    }));

    const client = new PaLM2Client({ apiKey: "fixture-key", baseUrl });
    await client.generateText(prompts.text_prompt_with_options, {
      model: "text-bison-002",
    });

    expect(captured[0].url).toBe(
      "/models/text-bison-002:generateText?key=fixture-key",
    );
  });
});
