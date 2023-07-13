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

public class RedisEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final RedisService redisService = retrofit.create(RedisService.class);

  private String indexName;
  private String namespace;

  // Getters;
  private WordEmbeddings wordEmbeddings;

  private int dimensions;

  private RedisDistanceMetric metric;

  private int topK;

  public RedisEndpoint() {}

  public RedisEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
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
  public WordEmbeddings getWordEmbeddings() {
    return wordEmbeddings;
  }

  public void setWordEmbeddings(WordEmbeddings wordEmbeddings) {
    this.wordEmbeddings = wordEmbeddings;
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

  public void setMetric(RedisDistanceMetric metric) {
    this.metric = metric;
  }

  public int getTopK() {
    return topK;
  }

  public void setTopK(int topK) {
    this.topK = topK;
  }

  // Convenience Methods
  public Observable<StringResponse> upsert(
      WordEmbeddings wordEmbeddings, int dimension, RedisDistanceMetric metric) {

    this.wordEmbeddings = wordEmbeddings;
    this.dimensions = dimension;
    this.metric = metric;

    return Observable.fromSingle(this.redisService.upsert(this));
  }

  public Observable<List<WordEmbeddings>> query(WordEmbeddings embeddings, int topK) {
    this.topK = topK;
    this.wordEmbeddings = embeddings;
    return Observable.fromSingle(this.redisService.query(this));
  }

  public void delete(String patternName) {
    this.redisService.deleteByPattern(patternName, this).blockingAwait();
  }
}
