package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.RedisService;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;
import java.util.List;
import java.util.StringJoiner;

public class RedisEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final RedisService redisService = retrofit.create(RedisService.class);

  private String indexName;
  private String namespace;

  // Getters;
  private WordEmbeddings wordEmbedding;
  private List<WordEmbeddings> wordEmbeddingsList;

  private int dimensions;

  private RedisDistanceMetric metric;

  private int topK;

  private String pattern;

  public RedisEndpoint() {}

  public RedisEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
  }

  public RedisEndpoint(String indexName) {
    this.indexName = indexName;
  }

  public RedisEndpoint(String indexName, RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.indexName = indexName;
  }

  public RedisEndpoint(String indexName, String namespace) {
    this.indexName = indexName;
    this.namespace = namespace;
  }

  public RedisEndpoint(String indexName, String namespace, RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.indexName = indexName;
    this.namespace = namespace;
  }

  public String getIndexName() {
    return indexName;
  }

  public void setIndexName(String indexName) {
    this.indexName = indexName;
  }

  public String getNamespace() {
    return namespace;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }

  // Getters
  public WordEmbeddings getWordEmbedding() {
    return wordEmbedding;
  }

  public void setWordEmbeddings(WordEmbeddings wordEmbedding) {
    this.wordEmbedding = wordEmbedding;
  }

  public int getDimensions() {
    return dimensions;
  }

  public void setDimensions(int dimensions) {
    this.dimensions = dimensions;
  }

  public RedisDistanceMetric getMetric() {
    return metric;
  }

  public List<WordEmbeddings> getWordEmbeddingsList() {
    return wordEmbeddingsList;
  }

  public void setMetric(RedisDistanceMetric metric) {
    this.metric = metric;
  }

  public int getTopK() {
    return topK;
  }

  public void setTopK(int topK) {
    this.topK = topK;
  }

  public String getPattern() {
    return pattern;
  }

  // Convenience Methods
  public StringResponse createIndex(String namespace, int dimension, RedisDistanceMetric metric) {
    this.dimensions = dimension;
    this.metric = metric;
    this.namespace = namespace;
    return this.redisService.createIndex(this).blockingGet();
  }

  public void batchUpsert(List<WordEmbeddings> wordEmbeddingsList) {
    this.wordEmbeddingsList = wordEmbeddingsList;
    this.redisService.batchUpsert(this).ignoreElement().blockingAwait();
  }

  public StringResponse upsert(WordEmbeddings wordEmbeddings) {
    this.wordEmbedding = wordEmbeddings;
    return this.redisService.upsert(this).blockingGet();
  }

  public Observable<List<WordEmbeddings>> query(WordEmbeddings embeddings, int topK) {
    this.topK = topK;
    this.wordEmbedding = embeddings;
    return Observable.fromSingle(this.redisService.query(this));
  }

  public void delete(String patternName) {
    this.pattern = patternName;
    this.redisService.deleteByPattern(this).blockingAwait();
  }

}
