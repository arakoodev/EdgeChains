export declare class PostgresClient {
    wordEmbeddings: number[][];
    metric: PostgresDistanceMetric;
    topK: number;
    probes: number;
    tableName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;
    constructor(wordEmbeddings: number[][], metric: any, topK: any, probes: any, tableName: any, namespace: string, arkRequest: any, upperLimit: any);
    dbQuery(): Promise<any>;
}
declare enum PostgresDistanceMetric {
    COSINE = "COSINE",
    IP = "IP",
    L2 = "L2"
}
export {};
