import pdf from "pdf-parse/lib/pdf-parse"

export class PdfLoader {
    pdfBuffer: Buffer;

    constructor(pdfBuffer: Buffer) {
        this.pdfBuffer = pdfBuffer;
    }

    async loadPdf() {
        try {
            const pdfdata = await pdf(this.pdfBuffer)
            return pdfdata.text;
        } catch (error) {
            console.error("Error loading PDF:", error);
            throw error;
        }
    }
}