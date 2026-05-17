import { createConnection, getManager } from "typeorm";
export class PostgresClient {
    wordEmbeddings: number[][];
    metric: PostgresDistanceMetric;
    topK: number;
    probes: number;
    tableName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;

    constructor(
        wordEmbeddings: number[][],
        metric: PostgresDistanceMetric,
        topK: number,
        probes: number,
        tableName: string,
        namespace: string,
        arkRequest: any,
        upperLimit: number
    ) {
        this.wordEmbeddings = wordEmbeddings;
        this.metric = metric;
        this.topK = topK;
        this.probes = probes;
        this.tableName = tableName;
        this.namespace = namespace;
        this.arkRequest = arkRequest;
        this.upperLimit = upperLimit;
    }

    async dbQuery() {
        const connection = await createConnection();
        const entityManager = await getManager();
        try {
            const query1 = `SET LOCAL ivfflat.probes = ${this.probes};`;
            await entityManager.query(query1);

            let query: string = "";

            for (let i = 0; i < this.wordEmbeddings.length; i++) {
                const embedding: string = JSON.stringify(this.wordEmbeddings[i]);

                query += `( SELECT id, raw_text, document_date, metadata, namespace, filename, timestamp, 
                ${this.arkRequest.textWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY text_rank DESC) + ${this.arkRequest.textWeight.fineTuneWeight}) +
                ${this.arkRequest.similarityWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY similarity DESC) + ${this.arkRequest.similarityWeight.fineTuneWeight}) +
                ${this.arkRequest.dateWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY date_rank DESC) + ${this.arkRequest.dateWeight.fineTuneWeight}) AS rrf_score
                FROM ( SELECT sv.id, sv.raw_text, sv.namespace, sv.filename, sv.timestamp, svtm.document_date, svtm.metadata, ts_rank_cd(sv.tsv, plainto_tsquery('${"english"}', '${this.arkRequest.query}')) AS text_rank, `;

                if (this.metric === PostgresDistanceMetric.COSINE)
                    query += `1 - (sv.embedding <=> '${embedding}') AS similarity, `;
                if (this.metric === PostgresDistanceMetric.IP)
                    query += `(sv.embedding <#> '${embedding}') * -1 AS similarity, `;
                if (this.metric === PostgresDistanceMetric.L2)
                    query += `sv.embedding <-> '${embedding}' AS similarity, `;

                query += `CASE WHEN svtm.document_date IS NULL THEN 0 ELSE EXTRACT(YEAR FROM svtm.document_date) * 365 + EXTRACT(DOY FROM svtm.document_date) END AS date_rank FROM (SELECT id, raw_text, embedding, tsv, namespace, filename, timestamp from ${this.tableName} WHERE namespace = '${this.namespace}'`;

                if (this.metric === PostgresDistanceMetric.COSINE)
                    query += ` ORDER BY embedding <=> '${embedding}'  LIMIT ${this.topK}`;
                if (this.metric === PostgresDistanceMetric.IP)
                    query += ` ORDER BY embedding <#> '${embedding}'  LIMIT ${this.topK}`;
                if (this.metric === PostgresDistanceMetric.L2)
                    query += ` ORDER BY embedding <-> '${embedding}'  LIMIT ${this.topK}`;

                query += `) sv JOIN ${this.tableName}_join_${this.arkRequest.metadataTable} jtm ON sv.id = jtm.id JOIN ${this.tableName}_${this.arkRequest.metadataTable} svtm ON jtm.metadata_id = svtm.metadata_id) subquery `;

                switch (this.arkRequest.orderRRF) {
                    case "text_rank":
                        query += `ORDER BY text_rank DESC, rrf_score DESC`;
                        break;
                    case "similarity":
                        query += `ORDER BY similarity DESC, rrf_score DESC`;
                        break;
                    case "date_rank":
                        query += `ORDER BY date_rank DESC, rrf_score DESC`;
                        break;
                    case "default":
                        query += `ORDER BY rrf_score DESC`;
                        break;
                }

                query += ` LIMIT ${this.topK})`;
                if (i < this.wordEmbeddings.length - 1) {
                    query += " UNION ALL \n";
                }
            }

            if (this.wordEmbeddings.length > 1) {
                query = `SELECT * FROM (SELECT DISTINCT ON (result.id) * FROM ( ${query} ) result) subquery ORDER BY rrf_score DESC LIMIT ${this.upperLimit};`;
            } else {
                query += ` ORDER BY rrf_score DESC LIMIT ${this.topK};`;
            }
            const results = await entityManager.query(query);
            return results;
        } finally {
            await connection.close();
        }
    }
}

export enum PostgresDistanceMetric {
    COSINE = "COSINE",
    IP = "IP",
    L2 = "L2",
}
