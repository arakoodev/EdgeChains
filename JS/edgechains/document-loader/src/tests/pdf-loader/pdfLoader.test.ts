import { PdfLoader } from "../../lib/pdf-loader/pdfLoader.js";
import pdf from "pdf-parse/lib/pdf-parse";

// Mock the pdf-parse library
jest.mock("pdf-parse/lib/pdf-parse", () => {
    return jest.fn().mockResolvedValue({ text: "Mock PDF text" });
});

describe("PdfLoader", () => {
    it("should load PDF data from buffer", async () => {
        // Create a mock PDF buffer
        const pdfBuffer = Buffer.from("Mock PDF Buffer");

        // Create an instance of PdfLoader with the mock PDF buffer
        const pdfLoader = new PdfLoader(pdfBuffer);

        // Call the loadPdf method
        const pdfText = await pdfLoader.loadPdf();

        // Expect that pdf-parse was called with the PDF buffer
        expect(pdf).toHaveBeenCalledWith(pdfBuffer);

        expect(pdfText).toEqual("Mock PDF text");
    });
    it("should load PDF data from buffer", async () => {
        // Create a mock PDF buffer
        const pdfBuffer = Buffer.from(
            "Expect that the loadPdf method returns the PDF text from the mock response"
        );

        // Create an instance of PdfLoader with the mock PDF buffer
        const pdfLoader = new PdfLoader(pdfBuffer);

        // Call the loadPdf method
        const pdfText = await pdfLoader.loadPdf();

        // Expect that pdf-parse was called with the PDF buffer
        expect(pdf).toHaveBeenCalledWith(pdfBuffer);

        // Expect that the loadPdf method returns the PDF text from the mock response
        expect(pdfText).toEqual("Mock PDF text");
    });
});
