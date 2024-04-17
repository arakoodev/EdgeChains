/// <reference types="node" />
export declare class PdfLoader {
    pdfBuffer: Buffer;
    constructor(pdfBuffer: Buffer);
    loadPdf(): Promise<any>;
}
