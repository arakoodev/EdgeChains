import path from "path";
import { SmartRouter, loadRouterJsonnetConfig } from "../../../arakoodev/src/ai/src/index.js";

export async function runSmartRouterExample(prompt: string) {
    const config = loadRouterJsonnetConfig(path.join(__dirname, "../jsonnet/router.jsonnet"));
    const router = new SmartRouter(config);
    return router.chat({ prompt });
}
