import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ComprehendRedaction, ComprehendConfig } from '../src/lib/aws/comprehend-redaction';
import { OpenAIEndpoint } from '../src/lib/openai/openai-endpoint'; // Assuming OpenAIEndpoint exists

// --- Configuration ---
// IMPORTANT: Replace with your actual AWS and OpenAI credentials.
// It's highly recommended to use environment variables for production.
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'YOUR_AWS_ACCESS_KEY_ID';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'YOUR_AWS_SECRET_ACCESS_KEY';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY';

if (AWS_ACCESS_KEY_ID === 'YOUR_AWS_ACCESS_KEY_ID' || AWS_SECRET_ACCESS_KEY === 'YOUR_AWS_SECRET_ACCESS_KEY') {
  console.warn('WARNING: AWS credentials are not set. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables or replace placeholders.');
  console.warn('This example will likely fail without proper AWS credentials.');
}

if (OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY') {
  console.warn('WARNING: OpenAI API key is not set. Please set OPENAI_API_KEY environment variable or replace placeholder.');
  console.warn('The OpenAI part of this example will likely fail without a proper API key.');
}

async function runComprehendRedactionExample() {
  console.log('--- AWS Comprehend Redaction Example ---');

  const awsConfig: ComprehendConfig = {
    region: AWS_REGION,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  };

  // 1. Initialize ComprehendRedaction
  const comprehendRedaction = new ComprehendRedaction(awsConfig, {
    languageCode: 'en',
    // Optionally, specify which PII types to redact.
    // entityTypes: [PiiEntityType.NAME, PiiEntityType.EMAIL]
  });

  // 2. Initialize an OpenAI Endpoint (optional, for chaining demonstration)
  const openAIEndpoint = new OpenAIEndpoint({
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    model: 'gpt-3.5-turbo',
  });

  // --- Example 1: Simple Redaction ---
  console.log('\n--- Simple Redaction ---');
  const sensitivePrompt1 = 'My name is John Doe, and my email is john.doe@example.com. My phone number is +1-555-123-4567.';
  console.log('Original Prompt 1:', sensitivePrompt1);

  comprehendRedaction.execute(of(sensitivePrompt1)).pipe(
    tap(redactedText => console.log('Redacted Prompt 1:', redactedText)),
    catchError(error => {
      console.error('Error during simple redaction:', error);
      return of('Error processing prompt 1.');
    })
  ).subscribe();

  // --- Example 2: Redaction with specific entity types ---
  console.log('\n--- Redaction with specific entity types (only NAME) ---');
  const sensitivePrompt2 = 'My name is Jane Smith, and my address is 123 Main St, Anytown, USA. My SSN is 999-88-7777.';
  console.log('Original Prompt 2:', sensitivePrompt2);

  const comprehendRedactionNameOnly = new ComprehendRedaction(awsConfig, {
    languageCode: 'en',
    entityTypes: ['NAME'], // Only redact names
  });

  comprehendRedactionNameOnly.execute(of(sensitivePrompt2)).pipe(
    tap(redactedText => console.log('Redacted Prompt 2 (Name Only):', redactedText)),
    catchError(error => {
      console.error('Error during specific entity redaction:', error);
      return of('Error processing prompt 2.');
    })
  ).subscribe();


  // --- Example 3: Chaining with an OpenAI Endpoint ---
  console.log('\n--- Chaining with OpenAI Endpoint ---');
  const sensitivePrompt3 = 'My name is Alice Johnson. What is the capital of France? My email is alice.j@example.com.';
  console.log('Original Prompt 3:', sensitivePrompt3);

  // The observable chain:
  // 1. Start with the original sensitive prompt.
  // 2. Pass it through ComprehendRedaction to redact PII.
  // 3. Pass the redacted prompt to the OpenAIEndpoint.
  // 4. Subscribe to get the final response.
  comprehendRedaction.execute(of(sensitivePrompt3)).pipe(
    tap(redactedPrompt => console.log('Redacted Prompt 3 (before OpenAI):', redactedPrompt)),
    openAIEndpoint.execute, // Chain the OpenAI endpoint here
    tap(openAIResponse => console.log('OpenAI Response (after redaction):', openAIResponse)),
    catchError(error => {
      console.error('Error during chained execution with OpenAI:', error.message);
      return of('Error during OpenAI interaction.');
    })
  ).subscribe({
    complete: () => console.log('\n--- Chained Example Complete ---')
  });

  // Give some time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 5000));
}

runComprehendRedactionExample();
