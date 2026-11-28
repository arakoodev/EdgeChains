import express from "express";
import { Request, Response } from "express";

const app = express();
app.use(express.json());

const requestCounts = new Map<string, { count: number; resetTime: number }>();

app.post("/v1/chat/completions", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const model = req.body.model || "gpt-3.5-turbo";
  const stream = req.body.stream || false;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        message: "Missing or invalid API key",
        type: "invalid_request_error",
      },
    });
  }

  const apiKey = authHeader.replace("Bearer ", "");
  const keyCount = requestCounts.get(apiKey) || {
    count: 0,
    resetTime: Date.now() + 60000,
  };

  if (keyCount.count >= 10) {
    return res.status(429).json({
      error: {
        message: "Rate limit exceeded",
        type: "rate_limit_error",
        param: null,
        code: "rate_limit_exceeded",
      },
    });
  }

  keyCount.count++;
  requestCounts.set(apiKey, keyCount);

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const messages = req.body.messages || [];
    const userMessage = messages.find((m: any) => m.role === "user");
    const content = userMessage?.content || "Hello";

    const chunks = content.split(" ");

    let chunkIndex = 0;
    const interval = setInterval(() => {
      if (chunkIndex >= chunks.length) {
        res.write("data: [DONE]\n\n");
        clearInterval(interval);
        res.end();
        return;
      }

      const chunk = {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [
          {
            index: 0,
            delta: {
              content: chunks[chunkIndex] + " ",
            },
            finish_reason: null,
          },
        ],
      };

      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      chunkIndex++;
    }, 100);

    return;
  }

  const messages = req.body.messages || [];
  const userMessage = messages.find((m: any) => m.role === "user");
  const content = userMessage?.content || "Hello";

  const response = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `Mock response: ${content}`,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };

  res.json(response);
});

app.post("/v1/embeddings", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const input = req.body.input || [];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        message: "Missing or invalid API key",
        type: "invalid_request_error",
      },
    });
  }

  const embeddings = input.map((_: any, i: number) => ({
    object: "embedding",
    embedding: new Array(1536).fill(0).map(() => Math.random() - 0.5),
    index: i,
  }));

  res.json({
    object: "list",
    data: embeddings,
    model: "text-embedding-ada-002",
    usage: {
      prompt_tokens: input.reduce(
        (acc: number, t: any) =>
          acc + (typeof t === "string" ? t.split(" ").length : 1),
        0,
      ),
      total_tokens: input.reduce(
        (acc: number, t: any) =>
          acc + (typeof t === "string" ? t.split(" ").length : 1),
        0,
      ),
    },
  });
});

const PORT = parseInt(process.env.MOCK_SERVER_PORT || "3001", 10);

export function startMockServer(port: number = PORT): Promise<void> {
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Mock OpenAI server running on port ${port}`);
      resolve();
    });
  });
}

export function stopMockServer(): void {
  process.exit(0);
}

if (require.main === module) {
  startMockServer();
}

export default app;
