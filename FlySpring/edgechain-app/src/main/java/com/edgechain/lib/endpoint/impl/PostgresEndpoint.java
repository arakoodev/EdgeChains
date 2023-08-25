package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.PostgresService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;

import java.time.LocalDateTime;
import java.util.List;

public class PostgresEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final PostgresService postgresService = retrofit.create(PostgresService.class);
  private String tableName;
  private int lists;

  private String namespace;

  private String filename;

  // Getters
  private WordEmbeddings wordEmbeddings;
  private PostgresDistanceMetric metric;
  private int dimensions;
  private int topK;

  private int probes;

  //Fields for metadata table
  private List<String> metadataTableNames;
  private String metadata;
  private LocalDateTime metadataDate;
  private Integer metadataId;
  private Integer embeddingId;

  public PostgresEndpoint() {}

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

  public void setEmbeddingId(Integer embeddingId) {
    this.embeddingId = embeddingId;
  }

  public void setMetadataDate(LocalDateTime metadataDate) {
    this.metadataDate = metadataDate;
  }

  public void setMetadataId(Integer metadataId) {
    this.metadataId = metadataId;
  }
  // Getters

  public WordEmbeddings getWordEmbeddings() {
    return wordEmbeddings;
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

  public Integer getEmbeddingId() {
    return embeddingId;
  }

  public LocalDateTime getMetadataDate() {
    return metadataDate;
  }

  public Integer getMetadataId() {
    return metadataId;
  }
  // Convenience Methods

  public Integer upsert(
      WordEmbeddings wordEmbeddings,
      String filename,
      int dimension,
      PostgresDistanceMetric metric,
      int lists) {
    this.wordEmbeddings = wordEmbeddings;
    this.dimensions = dimension;
    this.filename = filename;
    this.metric = metric;
    this.lists = lists;
    return this.postgresService.upsert(this).blockingGet();
  }

  public Integer insertMetadata(
          WordEmbeddings wordEmbeddings,
          int dimensions,
          PostgresDistanceMetric metric) {
    this.dimensions = dimensions;
    this.wordEmbeddings = wordEmbeddings;
    this.metric = metric;
    return this.postgresService.insertMetadata(this).blockingGet();
  }

  public StringResponse insertIntoJoinTable(Integer embeddingId, Integer metadataId) {
    this.embeddingId = embeddingId;
    this.metadataId = metadataId;
    return this.postgresService.insertIntoJoinTable(this).blockingGet();
  }

  public Observable<List<PostgresWordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {
    this.wordEmbeddings = wordEmbeddings;
    this.topK = topK;
    this.metric = metric;
    this.probes = 1;
    return Observable.fromSingle(this.postgresService.query(this));
  }

  public Observable<List<PostgresWordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK, int probes) {
    this.wordEmbeddings = wordEmbeddings;
    this.topK = topK;
    this.metric = metric;
    this.probes = probes;
    return Observable.fromSingle(this.postgresService.query(this));
  }

  public Observable<List<PostgresWordEmbeddings>> similaritySearchMetadata(
          WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK
  ) {
    this.wordEmbeddings = wordEmbeddings;
    this.topK = topK;
    this.metric = metric;
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
