import pdf from "pdf-parse/lib/pdf-parse.js";

export class PdfLoader {
    pdfBuffer: Buffer;
    constructor(pdfBuffer) {
        this.pdfBuffer = pdfBuffer;
    }

    async loadPdf() {
        try {
            // Convert Buffer to ArrayBuffer
            const arrayBuffer = this.bufferToArrayBuffer(this.pdfBuffer);

            // Parse PDF using pdf-parse library
            const pdfData = await pdf(arrayBuffer);
            return pdfData.text;
        } catch (error) {
            console.error("Error loading PDF:", error);
            throw error;
        }
    }

    bufferToArrayBuffer(buffer: Buffer) {
        // Create a new Uint8Array based on the Buffer
        const uint8Array = new Uint8Array(buffer);

        // Create ArrayBuffer from Uint8Array
        return uint8Array.buffer;
    }
}
