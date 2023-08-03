package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.responses.PostgresResponse;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.PostgresService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;

import java.util.List;

public class PostgresEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final PostgresService postgresService = retrofit.create(PostgresService.class);

  private String tableName;

  private String namespace;

  // Getters
  private WordEmbeddings wordEmbeddings;
  private PostgresDistanceMetric metric;
  private int dimensions;
  private int topK;
  private String fileName;

  public PostgresEndpoint() {}

  public PostgresEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
  }

  public PostgresEndpoint(String tableName, String namespace) {
    this.tableName = tableName;
    this.namespace = namespace;
  }

  public PostgresEndpoint(String tableName, String namespace, RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.tableName = tableName;
    this.namespace = namespace;
  }

  public void setFileName(String fileName) {
    this.fileName = fileName;
  }

  public void setTableName(String tableName) {
    this.tableName = tableName;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }

  public String getTableName() {
    return tableName;
  }

  public String getNamespace() {
    return namespace;
  }

  // Getters

  public String getFileName() {
    return fileName;
  }

  public WordEmbeddings getWordEmbeddings() {
    return wordEmbeddings;
  }

  public int getDimensions() {
    return dimensions;
  }

  public int getTopK() {
    return topK;
  }

  public PostgresDistanceMetric getMetric() {
    return metric;
  }

  // Convenience Methods
  public Observable<StringResponse> upsert(WordEmbeddings wordEmbeddings, int dimension) {
    this.wordEmbeddings = wordEmbeddings;
    this.dimensions = dimension;
    if (fileName != null) {
      return Observable.fromSingle(postgresService.upsertWithFilename(this));
    } else {
      return Observable.fromSingle(postgresService.upsert(this));
    }
  }

  public Observable<List<WordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {
    this.wordEmbeddings = wordEmbeddings;
    this.topK = topK;
    this.metric = metric;
    return Observable.fromSingle(this.postgresService.query(this));
  }

  public Observable<List<PostgresResponse>> queryWithFilename(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {
    this.wordEmbeddings = wordEmbeddings;
    this.topK = topK;
    this.metric = metric;
    return Observable.fromSingle(this.postgresService.queryWithFilename(this));
  }

  public Observable<StringResponse> deleteAll() {
    return Observable.fromSingle(this.postgresService.deleteAll(this));
  }
}
