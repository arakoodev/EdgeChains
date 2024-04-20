"use strict";
var g = Object.create;
var E = Object.defineProperty;
var _ = Object.getOwnPropertyDescriptor;
var b = Object.getOwnPropertyNames;
var S = Object.getPrototypeOf,
    f = Object.prototype.hasOwnProperty;
var p = (t, i) => () => (i || t((i = { exports: {} }).exports, i), i.exports),
    C = (t, i) => {
        for (var s in i) E(t, s, { get: i[s], enumerable: !0 });
    },
    h = (t, i, s, m) => {
        if ((i && typeof i == "object") || typeof i == "function")
            for (let e of b(i))
                !f.call(t, e) &&
                    e !== s &&
                    E(t, e, { get: () => i[e], enumerable: !(m = _(i, e)) || m.enumerable });
        return t;
    };
var D = (t, i, s) => (
        (s = t != null ? g(S(t)) : {}),
        h(i || !t || !t.__esModule ? E(s, "default", { value: t, enumerable: !0 }) : s, t)
    ),
    $ = (t) => h(E({}, "__esModule", { value: !0 }), t);
var u = p((d) => {
    "use strict";
    Object.defineProperty(d, "__esModule", { value: !0 });
    d.PostgresDistanceMetric = d.PostgresClient = void 0;
    var c = require("typeorm"),
        o = class {
            wordEmbeddings;
            metric;
            topK;
            probes;
            tableName;
            namespace;
            arkRequest;
            upperLimit;
            constructor(i, s, m, e, R, n, a, O) {
                (this.wordEmbeddings = i),
                    (this.metric = s),
                    (this.topK = m),
                    (this.probes = e),
                    (this.tableName = R),
                    (this.namespace = n),
                    (this.arkRequest = a),
                    (this.upperLimit = O);
            }
            async dbQuery() {
                let i = await (0, c.createConnection)(),
                    s = await (0, c.getManager)();
                try {
                    let m = `SET LOCAL ivfflat.probes = ${this.probes};`;
                    await s.query(m);
                    let e = "";
                    for (let n = 0; n < this.wordEmbeddings.length; n++) {
                        let a = JSON.stringify(this.wordEmbeddings[n]);
                        switch (
                            ((e += `( SELECT id, raw_text, document_date, metadata, namespace, filename, timestamp, 
                ${this.arkRequest.textWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY text_rank DESC) + ${this.arkRequest.textWeight.fineTuneWeight}) +
                ${this.arkRequest.similarityWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY similarity DESC) + ${this.arkRequest.similarityWeight.fineTuneWeight}) +
                ${this.arkRequest.dateWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY date_rank DESC) + ${this.arkRequest.dateWeight.fineTuneWeight}) AS rrf_score
                FROM ( SELECT sv.id, sv.raw_text, sv.namespace, sv.filename, sv.timestamp, svtm.document_date, svtm.metadata, ts_rank_cd(sv.tsv, plainto_tsquery('english', '${this.arkRequest.query}')) AS text_rank, `),
                            this.metric === r.COSINE &&
                                (e += `1 - (sv.embedding <=> '${a}') AS similarity, `),
                            this.metric === r.IP &&
                                (e += `(sv.embedding <#> '${a}') * -1 AS similarity, `),
                            this.metric === r.L2 &&
                                (e += `sv.embedding <-> '${a}' AS similarity, `),
                            (e += `CASE WHEN svtm.document_date IS NULL THEN 0 ELSE EXTRACT(YEAR FROM svtm.document_date) * 365 + EXTRACT(DOY FROM svtm.document_date) END AS date_rank FROM (SELECT id, raw_text, embedding, tsv, namespace, filename, timestamp from ${this.tableName} WHERE namespace = '${this.namespace}'`),
                            this.metric === r.COSINE &&
                                (e += ` ORDER BY embedding <=> '${a}'  LIMIT ${this.topK}`),
                            this.metric === r.IP &&
                                (e += ` ORDER BY embedding <#> '${a}'  LIMIT ${this.topK}`),
                            this.metric === r.L2 &&
                                (e += ` ORDER BY embedding <-> '${a}'  LIMIT ${this.topK}`),
                            (e += `) sv JOIN ${this.tableName}_join_${this.arkRequest.metadataTable} jtm ON sv.id = jtm.id JOIN ${this.tableName}_${this.arkRequest.metadataTable} svtm ON jtm.metadata_id = svtm.metadata_id) subquery `),
                            this.arkRequest.orderRRF)
                        ) {
                            case "text_rank":
                                e += "ORDER BY text_rank DESC, rrf_score DESC";
                                break;
                            case "similarity":
                                e += "ORDER BY similarity DESC, rrf_score DESC";
                                break;
                            case "date_rank":
                                e += "ORDER BY date_rank DESC, rrf_score DESC";
                                break;
                            case "default":
                                e += "ORDER BY rrf_score DESC";
                                break;
                        }
                        (e += ` LIMIT ${this.topK})`),
                            n < this.wordEmbeddings.length - 1 &&
                                (e += ` UNION ALL 
`);
                    }
                    return (
                        this.wordEmbeddings.length > 1
                            ? (e = `SELECT * FROM (SELECT DISTINCT ON (result.id) * FROM ( ${e} ) result) subquery ORDER BY rrf_score DESC LIMIT ${this.upperLimit};`)
                            : (e += ` ORDER BY rrf_score DESC LIMIT ${this.topK};`),
                        await s.query(e)
                    );
                } finally {
                    await i.close();
                }
            }
        };
    d.PostgresClient = o;
    var r;
    (function (t) {
        (t.COSINE = "COSINE"), (t.IP = "IP"), (t.L2 = "L2");
    })(r || (d.PostgresDistanceMetric = r = {}));
});
var I = {};
C(I, { PostgresClient: () => l.PostgresClient });
module.exports = $(I);
var l = D(u());
0 && (module.exports = { PostgresClient });
