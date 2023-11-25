export interface ArkRequest {
    topK: number;
    metadataTable: string;
    query: string;
    textWeight: {
        baseWeight: string;
        fineTuneWeight: string;
    };
    similarityWeight: {
        baseWeight: string;
        fineTuneWeight: string;
    };
    dateWeight: {
        baseWeight: string;
        fineTuneWeight: string;
    };
    orderRRF: string;
}
