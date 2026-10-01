import express from "express";
import { Request, Response } from "express";

const app = express();
app.use(express.json());

app.post("/v1/generate", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const model = req.body.model || "command";
  const streaming = req.body.streaming || false;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        message: "Missing or invalid API key",
        type: "invalid_request_error",
      },
    });
  }

  const prompt = req.body.prompt || "Hello";

  if (streaming) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const words = prompt.split(" ");

    let wordIndex = 0;
    const interval = setInterval(() => {
      if (wordIndex >= words.length) {
        res.write(
          JSON.stringify({
            event_type: "stream-end",
            finish_reason: "COMPLETE",
          }) + "\n",
        );
        clearInterval(interval);
        res.end();
        return;
      }

      res.write(
        JSON.stringify({
          event_type: "text-generation",
          text: words[wordIndex] + " ",
        }) + "\n",
      );
      wordIndex++;
    }, 100);

    return;
  }

  const response = {
    id: `gen-${Date.now()}`,
    prompt: prompt,
    text: `Mock Cohere response: ${prompt}`,
    finishReason: "COMPLETE",
    tokenCount: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
  };

  res.json(response);
});

const PORT = parseInt(process.env.MOCK_COHERE_PORT || "3003", 10);

export function startCohereMockServer(port: number = PORT): Promise<void> {
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Mock Cohere server running on port ${port}`);
      resolve();
    });
  });
}

export function stopCohereMockServer(): void {
  process.exit(0);
}

if (require.main === module) {
  startCohereMockServer();
}

export default app;
