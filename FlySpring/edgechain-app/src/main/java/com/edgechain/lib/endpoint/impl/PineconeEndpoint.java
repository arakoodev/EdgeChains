package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.PineconeService;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;

import java.util.List;

public class PineconeEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final PineconeService pineconeService = retrofit.create(PineconeService.class);

  private String namespace;

  // Getters;
  private WordEmbeddings wordEmbedding;

  private List<WordEmbeddings> wordEmbeddingsList;

  private int topK;

  public PineconeEndpoint() {}

  public PineconeEndpoint(String url, String apiKey) {
    super(url, apiKey);
  }

  public PineconeEndpoint(String url, String apiKey, RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
  }

  public PineconeEndpoint(String url, String apiKey, String namespace) {
    super(url, apiKey);
    this.namespace = namespace;
  }

  public PineconeEndpoint(String url, String apiKey, String namespace, RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.namespace = namespace;
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

  public List<WordEmbeddings> getWordEmbeddingsList() {
    return wordEmbeddingsList;
  }

  public void setWordEmbeddings(WordEmbeddings wordEmbedding) {
    this.wordEmbedding = wordEmbedding;
  }

  public int getTopK() {
    return topK;
  }

  public void setTopK(int topK) {
    this.topK = topK;
  }

  public StringResponse upsert(WordEmbeddings wordEmbeddings) {
    this.wordEmbedding = wordEmbeddings;
    return this.pineconeService.upsert(this).blockingGet();
  }

  public StringResponse batchUpsert(List<WordEmbeddings> wordEmbeddingsList) {
    this.wordEmbeddingsList = wordEmbeddingsList;
    return this.pineconeService.batchUpsert(this).blockingGet();
  }

  public Observable<List<WordEmbeddings>> query(WordEmbeddings wordEmbeddings, int topK) {
    this.wordEmbedding = wordEmbeddings;
    this.topK = topK;
    return Observable.fromSingle(this.pineconeService.query(this));
  }

  public StringResponse deleteAll() {
    return this.pineconeService.deleteAll(this).blockingGet();
  }
}
