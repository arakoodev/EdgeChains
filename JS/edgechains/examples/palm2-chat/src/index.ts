import Jsonnet from "@arakoodev/jsonnet";
import fileURLToPath from "file-uri-to-path";
import path from "path";

const { Palm2AI } = await import("@arakoodev/edgechains.js/ai");

const jsonnet = new Jsonnet();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

jsonnet.javascriptCallback("palm2Chat", ({ apiKey, prompt }: { apiKey: string; prompt: string }) => {
    const palm2 = new Palm2AI({ apiKey });
    return palm2.chat({ prompt });
});

const secretsPath = path.join(__dirname, "../jsonnet/secrets.jsonnet");
const secrets = JSON.parse(jsonnet.evaluateFile(secretsPath));

jsonnet.extString("palm2_api_key", secrets.palm2_api_key);
jsonnet.extString("prompt", "Say hello and explain what PaLM2 is in one sentence.");

const out = jsonnet.evaluateFile(path.join(__dirname, "../jsonnet/main.jsonnet"));
console.log(out);

