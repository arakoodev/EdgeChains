import Jsonnet from "@arakoodev/jsonnet";
import {
  AWSComprehendRedactor,
  type ComprehendClient,
  type ComprehendPiiEntity,
} from "@arakoodev/edgechains.js/ai";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mockComprehend: ComprehendClient = {
  async detectPiiEntities({ Text }) {
    const entities = [
      { Type: "NAME" as const, value: "Jane Doe", Score: 0.99 },
      { Type: "EMAIL" as const, value: "jane@site.test", Score: 0.99 },
      { Type: "PHONE" as const, value: "555-123-4567", Score: 0.96 },
    ]
      .map((entity): ComprehendPiiEntity | undefined => {
        const start = Text.indexOf(entity.value);
        return start === -1
          ? undefined
          : {
              Type: entity.Type,
              Score: entity.Score,
              BeginOffset: start,
              EndOffset: start + entity.value.length,
            };
      })
      .filter((entity): entity is ComprehendPiiEntity => Boolean(entity));

    return { Entities: entities };
  },
};

const redactor = new AWSComprehendRedactor({
  client: mockComprehend,
  minScore: 0.9,
});
const jsonnet = new Jsonnet();

async function run() {
  const response = jsonnet.evaluateFile(
    path.join(__dirname, "../jsonnet/main.jsonnet"),
  );
  const parsed = JSON.parse(response);
  const redaction = await redactor.redact(parsed.prompt, {
    languageCode: parsed.languageCode,
  });
  const protectedEndpoint = redactor.wrapChat({
    async chat({ prompt }: { prompt: string }) {
      return { content: `Safe prompt received:\n${prompt}` };
    },
  });

  const chatResponse = await protectedEndpoint.chat({ prompt: parsed.prompt });
  console.log(JSON.stringify({ ...parsed, redaction, chatResponse }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
