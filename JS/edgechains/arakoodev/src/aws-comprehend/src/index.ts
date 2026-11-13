export { AwsComprehend } from "./lib/comprehend/AwsComprehend.js";
export { splitIntoChunks } from "./lib/comprehend/AwsComprehend.js";
export { ComprehendPiiRedactor } from "./lib/redaction/ComprehendPiiRedactor.js";
export { RedactionObservable } from "./lib/redaction/RedactionObservable.js";

export type {
    AwsCredentials,
    CommandExecutor,
    ComprehendClientOptions,
    LanguageCode,
    PiiDetectionOptions,
    PiiEntity,
    PiiEntityType,
    PiiRedactionOptions,
    PiiRedactor,
} from "./types/index.js";
