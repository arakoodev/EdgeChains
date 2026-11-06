import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { Palm2Router } from "./routes/palm2.js";

const server = new ArakooServer();
const app = server.createApp();

app.route("/", Palm2Router);

server.listen(5000);
