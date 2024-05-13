declare class Jsonnet {
    constructor();
    evaluateSnippet(snippet: string): string;
    destroy(): void;
    extString(key: string, value: string): this;
    evaluateFile(filename: string): string;
    javascriptCallback(name: string, func: Function): this;
}

export default Jsonnet;
