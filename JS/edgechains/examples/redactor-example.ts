import { ComprehendRedactor } from "@arakoodev/edgechains.js/ai";

async function main() {
    // Initialize the redactor
    // Note: Ensure AWS_REGION and credentials are set in environment
    const redactor = new ComprehendRedactor({ region: "us-east-1" });

    const prompt = "Contact me at john.doe@example.com or call 555-0199. My SSN is 123-45-6789.";

    console.log("Original Prompt:", prompt);

    try {
        // Promise-based usage
        const result = await redactor.redactPrompt(prompt);
        console.log("\nRedacted Prompt (Promise):", result.redacted);
        console.log("Entities Detected:", result.entities.length);

        // Observable-based usage
        redactor.redactPrompt$(prompt).subscribe({
            next: (obsResult) => {
                console.log("\nRedacted Prompt (Observable):", obsResult.redacted);
            },
            error: (err) => console.error("Error:", err),
        });
    } catch (error) {
        console.error("Failed to redact prompt:", error);
    }
}

main();
