import { Comprehend } from "./comprehend";

const text = "Hello, my name is John Doe and my email is john.doe@example.com. I live in New York.";
const comprehend = new Comprehend();

async function run() {
    try {
        console.log("Original Text:", text);
        const redacted = await comprehend.redact(text);
        console.log("Redacted Text:", redacted);
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
