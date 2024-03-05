import { Hono } from "hono";
import dotenv from "dotenv";
import { Palm2ChatFn } from "@arakoodev/edgechains.js"

// Load environment variables from a .env file
dotenv.config();



export const Palm2Router = new Hono();

// Function to make a GPT-3 call based on a given query
async function Palm2Call(query: string) {

    // Load the Jsonnet module
    try {

        const palm2Response = await Palm2ChatFn(query, process.env.PALM2_API_KEY || "AIzaSyB2Cc5yX0q5HCOgMWtdsh5mALBorAiLlxE");

        // Return the  response
        return palm2Response;
    } catch (error) {
        // Log and rethrow any errors that occur during the process
        console.error(error);
        throw error;
    }
}

// Function to handle incoming HTTP requests with the given query
function UserInput(query: string) {
    console.log("UserInput called");

    Palm2Router.get("/", async (res) => {
        console.log("UserInput get called");
        res.json({ loading: true }); // Respond with a loading status

        try {
            // Call the reactChainCall function with the provided query
            const ReactChainCall = await Palm2Call(query);

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
    "How is shyam raghuwanshi?"
);

// let query="Author David Chanoff has collaborated with a U.S. Navy admiral who served as the ambassador to the United Kingdom under which President?"
