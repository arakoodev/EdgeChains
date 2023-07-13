package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
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

  private String jdbcUrl;
  private String username;
  private String password;
  private String tableName;

  // Getters
  private WordEmbeddings wordEmbeddings;
  private PostgresDistanceMetric metric;
  private int dimensions;
  private int topK;

  public PostgresEndpoint() {}

  public PostgresEndpoint(String jdbcUrl, String username, String password, String tableName) {
    this.jdbcUrl = jdbcUrl;
    this.username = username;
    this.password = password;
    this.tableName = tableName;
  }

  public PostgresEndpoint(
      String jdbcUrl, String username, String password, String tableName, RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.jdbcUrl = jdbcUrl;
    this.username = username;
    this.password = password;
    this.tableName = tableName;
  }

  public void setJdbcUrl(String jdbcUrl) {
    this.jdbcUrl = jdbcUrl;
  }

  public void setUsername(String username) {
    this.username = username;
  }

  public void setPassword(String password) {
    this.password = password;
  }

  public void setTableName(String tableName) {
    this.tableName = tableName;
  }

  public String getJdbcUrl() {
    return jdbcUrl;
  }

  public String getUsername() {
    return username;
  }

  public String getPassword() {
    return password;
  }

  public String getTableName() {
    return tableName;
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

  public PostgresDistanceMetric getMetric() {
    return metric;
  }

  // Convenience Methods
  public Observable<StringResponse> upsert(WordEmbeddings wordEmbeddings, int dimension) {
    this.wordEmbeddings = wordEmbeddings;
    this.dimensions = dimension;
    return Observable.fromSingle(postgresService.upsert(this));
  }

  public Observable<List<WordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {
    this.wordEmbeddings = wordEmbeddings;
    this.topK = topK;
    this.metric = metric;
    return Observable.fromSingle(this.postgresService.query(this));
  }

  public Observable<StringResponse> deleteAll() {
    return Observable.fromSingle(this.postgresService.deleteAll(this));
  }
}
