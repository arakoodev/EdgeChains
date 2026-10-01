import express from "express";
import { Request, Response } from "express";

const app = express();
app.use(express.json({ limit: "10mb" }));

app.post("/v1/models/:model:generateContent", (req: Request, res: Response) => {
  const apiKey = req.query.key as string;
  const model = req.params.model || "gemini-pro";

  if (!apiKey) {
    return res
      .status(401)
      .json({ error: { message: "Missing API key", status: "UNAUTHORIZED" } });
  }

  const contents = req.body.contents || [];
  const lastContent = contents[contents.length - 1];
  const parts = lastContent?.parts || [];
  const text = parts[0]?.text || "Hello";

  const response = {
    candidates: [
      {
        content: {
          role: "model",
          parts: [
            {
              text: `Mock Gemini response: ${text}`,
            },
          ],
        },
        finishReason: "STOP",
        index: 0,
        safetyRatings: [],
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      totalTokenCount: 30,
    },
  };

  res.json(response);
});

app.post(
  "/v1/models/:model:streamGenerateContent",
  (req: Request, res: Response) => {
    const apiKey = req.query.key as string;
    const model = req.params.model || "gemini-pro";

    if (!apiKey) {
      return res.status(401).json({
        error: { message: "Missing API key", status: "UNAUTHORIZED" },
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const contents = req.body.contents || [];
    const lastContent = contents[contents.length - 1];
    const parts = lastContent?.parts || [];
    const text = parts[0]?.text || "Hello";

    const words = text.split(" ");

    let wordIndex = 0;
    const interval = setInterval(() => {
      if (wordIndex >= words.length) {
        const finalChunk = JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{}],
              },
              finishReason: "STOP",
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        });
        res.write(finalChunk + "\n");
        clearInterval(interval);
        res.end();
        return;
      }

      const chunk = JSON.stringify({
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: words[wordIndex] + " " }],
            },
            finishReason: null,
            index: 0,
          },
        ],
      });

      res.write(chunk + "\n");
      wordIndex++;
    }, 100);
  },
);

const PORT = parseInt(process.env.MOCK_GEMINI_PORT || "3002", 10);

export function startGeminiMockServer(port: number = PORT): Promise<void> {
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Mock Gemini server running on port ${port}`);
      resolve();
    });
  });
}

export function stopGeminiMockServer(): void {
  process.exit(0);
}

if (require.main === module) {
  startGeminiMockServer();
}

export default app;
