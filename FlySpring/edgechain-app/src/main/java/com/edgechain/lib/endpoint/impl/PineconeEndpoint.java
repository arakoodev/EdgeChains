package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.PineconeService;
import com.edgechain.lib.index.request.feign.PineconeRequest;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;

import java.util.List;

public class PineconeEndpoint extends Endpoint {

  private String namespace;

  public PineconeEndpoint() {}

  public PineconeEndpoint(String namespace) {
    this.namespace = namespace;
  }

  public PineconeEndpoint(String url, String apiKey, String namespace) {
    super(url, apiKey);
    this.namespace = namespace;
  }

  public PineconeEndpoint(String url, String apiKey, String namespace, RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.namespace = namespace;
  }

  public Observable<StringResponse> upsert(WordEmbeddings wordEmbeddings) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    PineconeService pineconeService = retrofit.create(PineconeService.class);

    PineconeRequest request = new PineconeRequest();
    request.setEndpoint(this);
    request.setWordEmbeddings(wordEmbeddings);
    request.setNamespace(this.namespace);

    return Observable.fromSingle(pineconeService.upsert(request));
  }

  public Observable<List<WordEmbeddings>> query(WordEmbeddings embeddings, int topK) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    PineconeService pineconeService = retrofit.create(PineconeService.class);

    PineconeRequest request = new PineconeRequest();
    request.setEndpoint(this);
    request.setWordEmbeddings(embeddings);
    request.setNamespace(this.namespace);
    request.setTopK(topK);

    return Observable.fromSingle(pineconeService.query(request));
  }

  public Observable<StringResponse> deleteAll() {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    PineconeService pineconeService = retrofit.create(PineconeService.class);

    PineconeRequest request = new PineconeRequest();
    request.setEndpoint(this);
    request.setNamespace(this.namespace);

    return Observable.fromSingle(pineconeService.deleteAll(request));
  }
}
