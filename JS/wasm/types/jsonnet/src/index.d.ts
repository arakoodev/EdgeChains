declare class Jsonnet {
    constructor();
    evaluateSnippet(snippet: string): string;
    destroy(): void;
	extString(key: string, value: string): this;
}

export default Jsonnet;
