export declare class PostgresClient {
    wordEmbeddings: number[][];
    metric: PostgresDistanceMetric;
    topK: number;
    probes: number;
    tableName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;
    constructor(wordEmbeddings: number[][], metric: PostgresDistanceMetric, topK: number, probes: number, tableName: string, namespace: string, arkRequest: any, upperLimit: number);
    dbQuery(): Promise<any>;
}
export declare enum PostgresDistanceMetric {
    COSINE = "COSINE",
    IP = "IP",
    L2 = "L2"
}
