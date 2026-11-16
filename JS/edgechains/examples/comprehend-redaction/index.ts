import { ComprehendPiiRedactor } from "../../arakoodev/src/ai/src/lib/comprehend/comprehend.js";

// Uses AWS's default credential provider chain; do not put credentials in source.
// Run only with an authorized AWS account: Comprehend API usage may incur charges.
const redactor = new ComprehendPiiRedactor({
    region: process.env.AWS_REGION ?? "us-east-1",
    language: "es",
});

const endpoint = {
    async chat(options: { prompt?: string }) {
        console.log("Sanitized prompt:", options.prompt);
        return { content: "Received sanitized text." };
    },
};

async function main() {
    await redactor.next(endpoint).chat({
        prompt: "Mi nombre es Ana García y mi correo es ana@example.com.",
    });
}

main().catch(() => {
    // Avoid echoing provider errors that might include request content.
    console.error("Redaction failed; no prompt was forwarded.");
    process.exitCode = 1;
});
