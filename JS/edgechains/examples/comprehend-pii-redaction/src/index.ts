import {
  ComprehendPiiRedactor,
  type ComprehendLikeClient,
} from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();

const request =
  process.argv.slice(2).join(" ") ||
  "Jane Doe emailed jane@example.com about invoice 555-010-9999.";

jsonnet.extString("request", request);

const config = JSON.parse(
  jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")),
);

const mockClient: ComprehendLikeClient = {
  async send(command: any) {
    const text = command.input.Text || "";
    const nameStart = text.indexOf("Jane Doe");
    const emailStart = text.indexOf("jane@example.com");
    const phoneStart = text.indexOf("555-010-9999");

    return {
      Entities: [
        nameStart >= 0
          ? {
              Type: "NAME",
              BeginOffset: nameStart,
              EndOffset: nameStart + 8,
              Score: 0.99,
            }
          : undefined,
        emailStart >= 0
          ? {
              Type: "EMAIL",
              BeginOffset: emailStart,
              EndOffset: emailStart + 16,
              Score: 0.99,
            }
          : undefined,
        phoneStart >= 0
          ? {
              Type: "PHONE",
              BeginOffset: phoneStart,
              EndOffset: phoneStart + 12,
              Score: 0.99,
            }
          : undefined,
      ].filter(Boolean) as any,
    };
  },
};

const redactor = new ComprehendPiiRedactor({
  client: process.env.USE_REAL_AWS === "true" ? undefined : mockClient,
  region: process.env.AWS_REGION || "us-east-1",
  languageCode: config.languageCode,
  minScore: config.minScore,
});

const safePrompt = await redactor.redact(config.prompt);
console.log(safePrompt);
