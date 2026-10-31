import { createConnection, getManager } from "typeorm";

export function escapeSqlLiteral(val: unknown): string {
    if (val === null || val === undefined) {
        return "";
    }
    return String(val).replace(/\0/g, "").replace(/'/g, "''");
}

const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
export function validateSqlIdentifier(name: string): string {
    if (typeof name !== "string" || !SQL_IDENTIFIER_RE.test(name)) {
        throw new Error(`Invalid SQL identifier: ${JSON.stringify(name)}`);
    }
    return name;
}

export function sanitizeNumber(num: unknown): number {
    const parsed = typeof num === "number" ? num : Number(num);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid numeric value: ${String(num)}`);
    }
    return parsed;
}

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
        const safeTableName = validateSqlIdentifier(this.tableName);
        const safeMetadataTable = validateSqlIdentifier(this.arkRequest?.metadataTable);
        const safeJoinTable = validateSqlIdentifier(`${safeTableName}_join_${safeMetadataTable}`);
        const safeMetaTargetTable = validateSqlIdentifier(`${safeTableName}_${safeMetadataTable}`);
        const safeNamespace = escapeSqlLiteral(this.namespace);
        const safeSearchQuery = escapeSqlLiteral(this.arkRequest?.query);
        const safeProbes = Math.max(1, Math.trunc(sanitizeNumber(this.probes)));
        const safeTopK = Math.max(1, Math.trunc(sanitizeNumber(this.topK)));
        const safeUpperLimit = Math.max(1, Math.trunc(sanitizeNumber(this.upperLimit)));

        const textBaseWeight = sanitizeNumber(this.arkRequest?.textWeight?.baseWeight);
        const textFineTuneWeight = sanitizeNumber(this.arkRequest?.textWeight?.fineTuneWeight);
        const simBaseWeight = sanitizeNumber(this.arkRequest?.similarityWeight?.baseWeight);
        const simFineTuneWeight = sanitizeNumber(this.arkRequest?.similarityWeight?.fineTuneWeight);
        const dateBaseWeight = sanitizeNumber(this.arkRequest?.dateWeight?.baseWeight);
        const dateFineTuneWeight = sanitizeNumber(this.arkRequest?.dateWeight?.fineTuneWeight);

        const connection = await createConnection();
        const entityManager = await getManager();
        try {
            const query1 = `SET LOCAL ivfflat.probes = ${safeProbes};`;
            await entityManager.query(query1);

            let query: string = "";

            for (let i = 0; i < this.wordEmbeddings.length; i++) {
                const sanitizedVector = this.wordEmbeddings[i].map((v) => sanitizeNumber(v));
                const embedding: string = JSON.stringify(sanitizedVector);

                query += `( SELECT id, raw_text, document_date, metadata, namespace, filename, timestamp, 
                ${textBaseWeight} / (ROW_NUMBER() OVER (ORDER BY text_rank DESC) + ${textFineTuneWeight}) +
                ${simBaseWeight} / (ROW_NUMBER() OVER (ORDER BY similarity DESC) + ${simFineTuneWeight}) +
                ${dateBaseWeight} / (ROW_NUMBER() OVER (ORDER BY date_rank DESC) + ${dateFineTuneWeight}) AS rrf_score
                FROM ( SELECT sv.id, sv.raw_text, sv.namespace, sv.filename, sv.timestamp, svtm.document_date, svtm.metadata, ts_rank_cd(sv.tsv, plainto_tsquery('${"english"}', '${safeSearchQuery}')) AS text_rank, `;

                if (this.metric === PostgresDistanceMetric.COSINE)
                    query += `1 - (sv.embedding <=> '${embedding}') AS similarity, `;
                if (this.metric === PostgresDistanceMetric.IP)
                    query += `(sv.embedding <#> '${embedding}') * -1 AS similarity, `;
                if (this.metric === PostgresDistanceMetric.L2)
                    query += `sv.embedding <-> '${embedding}' AS similarity, `;

                query += `CASE WHEN svtm.document_date IS NULL THEN 0 ELSE EXTRACT(YEAR FROM svtm.document_date) * 365 + EXTRACT(DOY FROM svtm.document_date) END AS date_rank FROM (SELECT id, raw_text, embedding, tsv, namespace, filename, timestamp from ${safeTableName} WHERE namespace = '${safeNamespace}'`;

                if (this.metric === PostgresDistanceMetric.COSINE)
                    query += ` ORDER BY embedding <=> '${embedding}'  LIMIT ${safeTopK}`;
                if (this.metric === PostgresDistanceMetric.IP)
                    query += ` ORDER BY embedding <#> '${embedding}'  LIMIT ${safeTopK}`;
                if (this.metric === PostgresDistanceMetric.L2)
                    query += ` ORDER BY embedding <-> '${embedding}'  LIMIT ${safeTopK}`;

                query += `) sv JOIN ${safeJoinTable} jtm ON sv.id = jtm.id JOIN ${safeMetaTargetTable} svtm ON jtm.metadata_id = svtm.metadata_id) subquery `;

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

                query += ` LIMIT ${safeTopK})`;
                if (i < this.wordEmbeddings.length - 1) {
                    query += " UNION ALL \n";
                }
            }

            if (this.wordEmbeddings.length > 1) {
                query = `SELECT * FROM (SELECT DISTINCT ON (result.id) * FROM ( ${query} ) result) subquery ORDER BY rrf_score DESC LIMIT ${safeUpperLimit};`;
            } else {
                query += ` ORDER BY rrf_score DESC LIMIT ${safeTopK};`;
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
