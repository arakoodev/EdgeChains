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
  private WordEmbeddings wordEmbeddings;

  private int topK;

  public PineconeEndpoint() {}

  public PineconeEndpoint(String namespace) {
    this.namespace = namespace;
  }

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

  public WordEmbeddings getWordEmbeddings() {
    return wordEmbeddings;
  }

  public void setWordEmbeddings(WordEmbeddings wordEmbeddings) {
    this.wordEmbeddings = wordEmbeddings;
  }

  public int getTopK() {
    return topK;
  }

  public void setTopK(int topK) {
    this.topK = topK;
  }

  public StringResponse upsert(WordEmbeddings wordEmbeddings) {
    this.wordEmbeddings = wordEmbeddings;
    return this.pineconeService.upsert(this).blockingGet();
  }

  public List<WordEmbeddings> query(WordEmbeddings wordEmbeddings, int topK) {
    this.wordEmbeddings = wordEmbeddings;
    this.topK = topK;
    return this.pineconeService.query(this).blockingGet();
  }

  public StringResponse deleteAll() {
    return this.pineconeService.deleteAll(this).blockingGet();
  }
}
