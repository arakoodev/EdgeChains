import "htmx.org";
import { RetellWebClient } from "@arakoodev/edgechains.js/ai";
import "./style.css";

// Create a single instance
const retellWebClient = new RetellWebClient();

async function startCall(access_token) {
    try {
        const callResponse = await retellWebClient.startCall({
            accessToken: access_token,
        });

        console.log("Call started:", callResponse);
        document.getElementById("callStatus").textContent = "Call in progress...";
    } catch (error) {
        console.error("Failed to start call:", error);
        document.getElementById("error").textContent = `Failed to start call: ${error.message}`;
    }
}

async function endCall() {
    try {
        await retellWebClient.stopCall();
        console.log("Call ended successfully");
        document.getElementById("callStatus").textContent = "Call ended";
    } catch (error) {
        console.error("Failed to end call:", error);
        document.getElementById("error").textContent = `Failed to end call: ${error.message}`;
    }
}

// Expose functions to be used with hyperscript or other event handlers
window.startCall = startCall;
window.endCall = endCall;

console.log("Client-side code initialized");
