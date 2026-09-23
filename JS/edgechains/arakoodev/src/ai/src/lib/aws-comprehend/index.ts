export { AWSComprehend } from "./comprehend.js";
export type {
    AWSComprehendOptions,
    RedactOptions,
    RedactResult,
    DetectPiiOptions,
    DetectPiiResult,
    DetectedEntity,
} from "./comprehend.js";

export {
    redact$,
    redactPii,
    redactPiiText,
    redactPiiBatch,
} from "./observables.js";
