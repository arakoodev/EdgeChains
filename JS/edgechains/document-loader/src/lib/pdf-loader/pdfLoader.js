"use strict";
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfLoader = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse/lib/pdf-parse"));
class PdfLoader {
    pdfBuffer;
    constructor(pdfBuffer) {
        this.pdfBuffer = pdfBuffer;
    }
    async loadPdf() {
        try {
            const pdfdata = await (0, pdf_parse_1.default)(this.pdfBuffer);
            return pdfdata.text;
        } catch (error) {
            console.error("Error loading PDF:", error);
            throw error;
        }
    }
}
exports.PdfLoader = PdfLoader;
