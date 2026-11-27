import Jsonnet from "@arakoodev/jsonnet";
import { createSyncRPC } from "@arakoodev/edgechains.js/sync-rpc";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const redactPrompt = createSyncRPC(
  path.join(__dirname, "./lib/redactPrompt.cjs"),
);

async function main(): Promise<void> {
  const inputPrompt =
    process.env.INPUT_PROMPT ||
    "Please email Rahul at rahul@example.com about account 1234.";
  const mockMode = process.env.MOCK_AWS_COMPREHEND === "true";

  jsonnet.extString("input_prompt", inputPrompt);
  jsonnet.javascriptCallback("redactPrompt", (request: any) => {
    return redactPrompt({
      ...request,
      awsRegion: process.env.AWS_REGION || "us-east-1",
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      mockMode,
    });
  });

  const response = jsonnet.evaluateFile(
    path.join(__dirname, "../jsonnet/main.jsonnet"),
  );
  console.log(response);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
