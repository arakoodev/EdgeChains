export interface HydeFragmentData {
    responses: Array<{
        rawText?: string;
        metadata?: string;
        filename?: string;
        titleMetadata?: string;
        documentDate?: string;
    }>;
    final_answer?: string;
}
