import { AwsComprehendRedactor } from "@arakoodev/edgechains.js/ai";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import { fileURLToPath } from "url";

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

jsonnet.extString("customer_name", process.env.CUSTOMER_NAME ?? "Alice Example");
jsonnet.extString("customer_email", process.env.CUSTOMER_EMAIL ?? "alice@example.com");
jsonnet.extString("customer_phone", process.env.CUSTOMER_PHONE ?? "555-010-2020");

const config = JSON.parse(jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet")));

const redactor = new AwsComprehendRedactor({
    clientConfig: {
        region: process.env.AWS_REGION ?? "us-east-1",
    },
    ...config.redaction,
});

const result = await redactor.redact(config.prompt);

console.log(JSON.stringify(result, null, 2));
