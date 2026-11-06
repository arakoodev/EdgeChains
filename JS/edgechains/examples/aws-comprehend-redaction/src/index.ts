import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { RedactRouter } from "./routes/redact.js";

const server = new ArakooServer();
const app = server.createApp();

app.route("/", RedactRouter);

server.listen(3000);
