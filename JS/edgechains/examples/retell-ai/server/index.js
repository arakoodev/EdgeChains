import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver"
import { RetellAI } from "@arakoodev/edgechains.js/ai"
import { serveStatic } from '@hono/node-server/serve-static';
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import fileURLToPath from "file-uri-to-path";

const __dirname = fileURLToPath(import.meta.url);
const jsonnet = new Jsonnet();
const server = new ArakooServer();
const app = server.createApp();

const jsonnet_main_file = path.join(__dirname, "../../jsonnet/main.jsonnet");
const jsonnet_secrets_file = path.join(__dirname, "../../jsonnet/secrets.jsonnet");
const jsonnet_main_obj = JSON.parse(jsonnet.evaluateFile(jsonnet_main_file));
const jsonnet_secrets_obj = JSON.parse(jsonnet.evaluateFile(jsonnet_secrets_file));

const retellai = new RetellAI(jsonnet_secrets_obj.reteall_api_key);

await retellai.createLLM({
    general_prompt: jsonnet_main_obj.general_prompt,
    begin_message: jsonnet_main_obj.begin_message
})

const createAgentRes = await retellai.createAgent({});

app.get(
    '/static/*',
    serveStatic({
        root: './dist',
        rewriteRequestPath: (path) =>
            path.replace(/^\/static/, '/'),
    }))


app.get("/", (c) => {
    return c.html(`<html>
        <head>
            <title>HTMX Demo</title>
            <script src="/static/bundle.js" defer></script>
            <script src="https://unpkg.com/hyperscript.org@0.9.12"></script>
        </head>
        <body>
             <div class="controls flex flex-col h-[100vh] w-full justify-center items-center space-y-6">
             <div class="flex space-x-4">
                <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" _="on click js 
                fetch('http://localhost:3000/call').then(async(res)=>{
                    console.log(res)
                    const {token} = await res.json();
                    startCall(token)
                    });
                 end">Start Call</button>
                <button class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded" _="on click call endCall()">End Call</button>
            </div>
            <div class="status flex space-x-4">
                <p class="bg-green-600 p-2 rounded-md">Call Status: <span id="callStatus">Not started</span></p>
                <p class=" bg-red-600 p-2 rounded-md">Error: No Error<span id="error"></span></p>
            </div>
            </div>
        </body>
    </html>`);
})


app.get("/call", async (c) => {
    const token = await retellai.initiateWebCall(createAgentRes.agent_id)
    return c.json({ token })
})

server.listen(3000)