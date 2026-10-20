import { OpenAI, AWSComprehend, createRedactionMiddleware } from "@arakoodev/edgechains.js/ai";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Example 1: Basic PII Detection
 */
async function example1_detectPii() {
    console.log("\n=== Example 1: Basic PII Detection ===\n");

    const comprehend = new AWSComprehend({
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    const text = "My name is John Doe, my email is john.doe@example.com, and my phone number is 555-123-4567.";
    
    console.log("Original text:", text);
    
    const result = await comprehend.detectPii({ text });
    
    console.log("\nPII Detection Result:");
    console.log("Contains PII:", result.containsPii);
    console.log("Entities found:", result.entities.length);
    
    result.entities.forEach((entity, index) => {
        console.log(`\n  Entity ${index + 1}:`);
        console.log(`    Type: ${entity.type}`);
        console.log(`    Confidence: ${(entity.score * 100).toFixed(2)}%`);
        console.log(`    Position: ${entity.beginOffset}-${entity.endOffset}`);
    });
}

/**
 * Example 2: PII Redaction
 */
async function example2_redactPii() {
    console.log("\n=== Example 2: PII Redaction ===\n");

    const comprehend = new AWSComprehend();

    const text = "Please contact Jane Smith at jane.smith@company.com or call her at 555-987-6543. Her SSN is 123-45-6789.";
    
    console.log("Original text:", text);
    
    const result = await comprehend.redact({ text });
    
    console.log("\nRedacted text:", result.redactedText);
    console.log("\nEntities redacted:", result.entitiesFound.length);
    
    result.entitiesFound.forEach((entity, index) => {
        console.log(`  ${index + 1}. ${entity.type} (confidence: ${(entity.score * 100).toFixed(2)}%)`);
    });
}

/**
 * Example 3: Custom Redaction Character
 */
async function example3_customRedaction() {
    console.log("\n=== Example 3: Custom Redaction Character ===\n");

    const comprehend = new AWSComprehend();

    const text = "My credit card number is 4532-1234-5678-9010 and my email is user@example.com";
    
    console.log("Original text:", text);
    
    // Redact with 'X' instead of '*'
    const result = await comprehend.redact({ 
        text,
        redactionChar: "X"
    });
    
    console.log("Redacted text:", result.redactedText);
}

/**
 * Example 4: Chaining with OpenAI
 */
async function example4_chainWithOpenAI() {
    console.log("\n=== Example 4: Chaining with OpenAI ===\n");

    const comprehend = new AWSComprehend();
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const userPrompt = "Hi, I'm Sarah Johnson and my email is sarah.j@email.com. Can you help me with my account?";
    
    console.log("Original prompt:", userPrompt);
    
    // Chain: Redact PII first, then send to OpenAI
    const aiResponse = await comprehend.chain(
        userPrompt,
        async (redactedPrompt) => {
            console.log("\nRedacted prompt sent to AI:", redactedPrompt);
            
            const response = await openai.chat({
                prompt: redactedPrompt,
                model: "gpt-3.5-turbo",
                max_tokens: 100,
            });
            
            return response.content;
        }
    );
    
    console.log("\nAI Response:", aiResponse);
}

/**
 * Example 5: Using Redaction Middleware
 */
async function example5_middleware() {
    console.log("\n=== Example 5: Using Redaction Middleware ===\n");

    const middleware = createRedactionMiddleware();
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const userPrompt = "My name is Michael Brown, SSN: 987-65-4321. I need help with my account.";
    
    console.log("Original prompt:", userPrompt);
    
    // Execute with middleware
    const result = await middleware.execute(
        userPrompt,
        async (redactedPrompt) => {
            console.log("\nRedacted prompt:", redactedPrompt);
            
            return await openai.chat({
                prompt: redactedPrompt,
                model: "gpt-3.5-turbo",
                max_tokens: 100,
            });
        }
    );
    
    console.log("\nAI Response:", result.result.content);
    console.log("\nRedaction Info:");
    console.log("  Entities found:", result.redactionInfo.entitiesFound.length);
    result.redactionInfo.entitiesFound.forEach((entity, index) => {
        console.log(`    ${index + 1}. ${entity.type} (${(entity.score * 100).toFixed(2)}%)`);
    });
}

/**
 * Example 6: Wrapped Endpoint
 */
async function example6_wrappedEndpoint() {
    console.log("\n=== Example 6: Wrapped Endpoint ===\n");

    const middleware = createRedactionMiddleware();
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    // Create a simple endpoint function
    const chatEndpoint = async (prompt: string) => {
        const response = await openai.chat({
            prompt,
            model: "gpt-3.5-turbo",
            max_tokens: 100,
        });
        return response.content;
    };

    // Wrap it with automatic redaction
    const secureChat = middleware.wrap(chatEndpoint);

    const userPrompt = "Hi, I'm Alice (alice@company.com). Can you help me?";
    
    console.log("Original prompt:", userPrompt);
    
    // Now secureChat automatically redacts PII before calling OpenAI
    const response = await secureChat(userPrompt);
    
    console.log("\nAI Response:", response);
}

/**
 * Example 7: Batch Redaction
 */
async function example7_batchRedaction() {
    console.log("\n=== Example 7: Batch Redaction ===\n");

    const comprehend = new AWSComprehend();

    const texts = [
        "Contact John at john@example.com",
        "Call Jane at 555-1234",
        "SSN: 123-45-6789",
        "This text has no PII",
    ];
    
    console.log("Original texts:");
    texts.forEach((text, index) => {
        console.log(`  ${index + 1}. ${text}`);
    });
    
    const results = await comprehend.redactBatch(texts);
    
    console.log("\nRedacted texts:");
    results.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.redactedText} (${result.entitiesFound.length} entities)`);
    });
}

/**
 * Main function to run all examples
 */
async function main() {
    console.log("AWS Comprehend PII Redaction Examples");
    console.log("=====================================");

    try {
        // Run examples that don't require OpenAI
        await example1_detectPii();
        await example2_redactPii();
        await example3_customRedaction();
        await example7_batchRedaction();

        // Uncomment these if you have OpenAI API key configured
        // await example4_chainWithOpenAI();
        // await example5_middleware();
        // await example6_wrappedEndpoint();

        console.log("\n✅ All examples completed successfully!");
    } catch (error) {
        console.error("\n❌ Error running examples:", error);
        process.exit(1);
    }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
