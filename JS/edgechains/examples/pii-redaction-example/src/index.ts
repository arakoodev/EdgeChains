import "dotenv/config";
import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { RedactRouter } from "./routes/redact.js";

const server = new ArakooServer();
const app = server.createApp();

app.route("/redact", RedactRouter);

server.listen(3000);
console.log("PII Redaction Example running on http://localhost:3000");
console.log("Try: GET /redact?text=Hello+my+name+is+John+Doe+and+my+email+is+john@example.com");
