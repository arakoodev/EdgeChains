package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.RedisService;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.index.request.feign.RedisRequest;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;
import java.util.List;

public class RedisEndpoint extends Endpoint {

  private String indexName;
  private String namespace;

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

  public Observable<StringResponse> upsert(
      WordEmbeddings wordEmbeddings, int dimension, RedisDistanceMetric metric) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    RedisService redisService = retrofit.create(RedisService.class);

    RedisRequest request = new RedisRequest();
    request.setEndpoint(this);
    request.setWordEmbeddings(wordEmbeddings);
    request.setIndexName(this.indexName);
    request.setNamespace(this.namespace);
    request.setDimensions(dimension);
    request.setMetric(metric);

    return Observable.fromSingle(redisService.upsert(request));
  }

  public Observable<List<WordEmbeddings>> query(WordEmbeddings embeddings, int topK) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    RedisService redisService = retrofit.create(RedisService.class);

    RedisRequest request = new RedisRequest();
    request.setTopK(topK);
    request.setWordEmbeddings(embeddings);
    request.setIndexName(this.indexName);
    request.setNamespace(this.namespace);
    request.setEndpoint(this);

    return Observable.fromSingle(redisService.query(request));
  }

  public void delete(String patternName) {
    Retrofit retrofit = RetrofitClientInstance.getInstance();
    RedisService redisService = retrofit.create(RedisService.class);

    RedisRequest redisRequest = new RedisRequest();
    redisRequest.setEndpoint(this);

    redisService.deleteByPattern(patternName, redisRequest).blockingAwait();
  }
}
