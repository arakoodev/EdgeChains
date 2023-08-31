package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.PostgresService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.jdbc.core.JdbcTemplate;
import retrofit2.Retrofit;

import java.util.List;

public class PostgresEndpoint extends Endpoint {

    private final Retrofit retrofit = RetrofitClientInstance.getInstance();
    private final PostgresService postgresService = retrofit.create(PostgresService.class);
    private String tableName;
    private int lists;

    private String id;
    private String namespace;

    private String filename;

    // Getters
    private WordEmbeddings wordEmbedding;

    private List<WordEmbeddings> wordEmbeddingsList;

    private PostgresDistanceMetric metric;
    private int dimensions;
    private int topK;

    private int probes;

    // Fields for metadata table
    private List<String> metadataTableNames;
    private String metadata;
    private String metadataId;


    public PostgresEndpoint() {
    }

    public PostgresEndpoint(RetryPolicy retryPolicy) {
        super(retryPolicy);
    }

    public PostgresEndpoint(String tableName) {
        this.tableName = tableName;
    }

    public PostgresEndpoint(String tableName, List<String> metadataTableNames) {
        this.tableName = tableName;
        this.metadataTableNames = metadataTableNames;
    }

    public PostgresEndpoint(String tableName, RetryPolicy retryPolicy) {
        super(retryPolicy);
        this.tableName = tableName;
    }

    public String getTableName() {
        return tableName;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public void setMetadataTableName(List<String> metadataTableNames) {
        this.metadataTableNames = metadataTableNames;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public void setId(String id) {
        this.id = id;
    }

    public void setMetadataId(String metadataId) {
        this.metadataId = metadataId;
    }

    // Getters

    public WordEmbeddings getWordEmbedding() {
        return wordEmbedding;
    }

    public int getDimensions() {
        return dimensions;
    }

    public int getTopK() {
        return topK;
    }

    public String getFilename() {
        return filename;
    }

    public List<WordEmbeddings> getWordEmbeddingsList() {
        return wordEmbeddingsList;
    }

    public PostgresDistanceMetric getMetric() {
        return metric;
    }

    public int getLists() {
        return lists;
    }

    public int getProbes() {
        return probes;
    }

    public List<String> getMetadataTableNames() {
        return metadataTableNames;
    }

    public String getMetadata() {
        return metadata;
    }

    public String getMetadataId() {
        return metadataId;
    }

    public String getId() {
        return id;
    }

    public StringResponse upsert(
            WordEmbeddings wordEmbeddings,
            String filename,
            int dimension,
            PostgresDistanceMetric metric) {
        this.wordEmbedding = wordEmbeddings;
        this.dimensions = dimension;
        this.filename = filename;
        this.metric = metric;
        return this.postgresService.upsert(this).blockingGet();
    }

    public StringResponse createTable(int dimensions, PostgresDistanceMetric metric, int lists) {
        this.dimensions = dimensions;
        this.metric = metric;
        this.lists = lists;
        return this.postgresService.createTable(this).blockingGet();
    }

    public StringResponse createMetadataTable(int dimensions) {
        this.dimensions = dimensions;
        return this.postgresService.createMetadataTable(this).blockingGet();
    }

    public List<StringResponse> upsert(
            List<WordEmbeddings> wordEmbeddingsList,
            String filename
    ) {
        this.wordEmbeddingsList = wordEmbeddingsList;
        this.filename = filename;
        return this.postgresService.batchUpsert(this).blockingGet();
    }

    public StringResponse insertMetadata(
            WordEmbeddings wordEmbeddings, int dimensions, PostgresDistanceMetric metric) {
        this.dimensions = dimensions;
        this.wordEmbedding = wordEmbeddings;
        this.metric = metric;
        return this.postgresService.insertMetadata(this).blockingGet();
    }

    public List<StringResponse> batchInsertMetadata(
            List<WordEmbeddings> wordEmbeddingsList) {
        this.wordEmbeddingsList = wordEmbeddingsList;
        return this.postgresService.batchInsertMetadata(this).blockingGet();
    }

    public StringResponse insertIntoJoinTable(String id, String metadataId) {
        this.id = id;
        this.metadataId = metadataId;
        return this.postgresService.insertIntoJoinTable(this).blockingGet();
    }

    public Observable<List<PostgresWordEmbeddings>> query(
            WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {
        this.wordEmbedding = wordEmbeddings;
        this.topK = topK;
        this.metric = metric;
        this.probes = 1;
        return Observable.fromSingle(this.postgresService.query(this));
    }

    public Observable<List<PostgresWordEmbeddings>> query(
            WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK, int probes) {
        this.wordEmbedding = wordEmbeddings;
        this.topK = topK;
        this.metric = metric;
        this.probes = probes;
        return Observable.fromSingle(this.postgresService.query(this));
    }

    public Observable<List<PostgresWordEmbeddings>> similaritySearchMetadata(
            WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric,  int topK) {
        this.wordEmbedding = wordEmbeddings;
        this.topK = topK;
        this.metric = metric;
        this.probes = 1;
        return Observable.fromSingle(this.postgresService.similaritySearchMetadata(this));
    }

    public Observable<List<PostgresWordEmbeddings>> similaritySearchMetadata(
            WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int probes, int topK) {
        this.wordEmbedding = wordEmbeddings;
        this.topK = topK;
        this.metric = metric;
        this.probes = probes;
        return Observable.fromSingle(this.postgresService.similaritySearchMetadata(this));
    }

    public Observable<List<PostgresWordEmbeddings>> getAllChunks(String tableName, String filename) {
        this.tableName = tableName;
        this.filename = filename;
        return Observable.fromSingle(this.postgresService.getAllChunks(this));
    }

    public StringResponse deleteAll() {
        return this.postgresService.deleteAll(this).blockingGet();
    }
}
