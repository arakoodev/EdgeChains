// Import necessary modules and libraries
// import { Jsonnet } from "@hanazuki/node-jsonnet";
import { OpenAiEndpoint } from "@arakoodev/edgechains.js";
import * as path from "path";
import { Hono } from "hono";
import dotenv from "dotenv";

// Load environment variables from a .env file
dotenv.config();

const getJsonnet = async () => {
    let jsonnet = await import("@arakoodev/jsonnet");
    return jsonnet.default;
};

// Create instances of Jsonnet, Hono, and OpenAiEndpoint
export const ReactChainRouter = new Hono();

const gpt3Endpoint = new OpenAiEndpoint(
    "https://api.openai.com/v1/chat/completions",
    process.env.OPENAI_API_KEY!,
    "",
    "gpt-4",
    "user",
    parseInt("0.7")
);

// Define file paths for Jsonnet templates
const promptPath = path.join(__dirname, "../src/react-chain.jsonnet");
const InterPath = path.join(__dirname, "../src/intermediate.jsonnet");

// Function to make a GPT-3 call based on a given query
export async function reactChainCall(query: string) {
    // Load the Jsonnet module
    const Jsonnet = await getJsonnet();
    const jsonnet = new Jsonnet();
    try {
        // Load and parse the custom template from react-chain.jsonnet
        const promptLoader = await jsonnet.evaluateFile(promptPath);
        const promptTemplate = JSON.parse(promptLoader).custom_template;

        // Load and parse the intermediate template, injecting the prompt template and query
        let InterLoader = await jsonnet
            .extString("promptTemplate", promptTemplate)
            .extString("query", query)
            .evaluateFile(InterPath);

        const prompt = JSON.parse(InterLoader).prompt;

        // Make a GPT-3 call using the OpenAiEndpoint
        const gptResponse = await gpt3Endpoint.gptFn(prompt);

        // Return the  response
        return gptResponse;
    } catch (error) {
        // Log and rethrow any errors that occur during the process
        console.error(error);
        throw error;
    }
}

// Function to handle incoming HTTP requests with the given query
export function UserInput(query: string) {
    console.log("UserInput called");

    ReactChainRouter.get("/", async (res) => {
        console.log("UserInput get called");
        res.json({ loading: true }); // Respond with a loading status

        try {
            // Call the reactChainCall function with the provided query
            const ReactChainCall = await reactChainCall(query);

            // Respond with the ReactChainCall response
            return res.json({ answer: ReactChainCall });
        } catch (error) {
            // If an error occurs, respond with an error status and message
            return res.json({ error: "An error occurred" }, 500);
        }
    });
}

// Example usage: Make a UserInput call with a specific query
UserInput(
    "Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President?"
);

// let query="Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President?"
