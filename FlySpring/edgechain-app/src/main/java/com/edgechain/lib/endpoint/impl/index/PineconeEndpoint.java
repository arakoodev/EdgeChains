package com.edgechain.lib.endpoint.impl.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.embeddings.EmbeddingEndpoint;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.PineconeService;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

import java.util.List;

public class PineconeEndpoint extends Endpoint {

  private static final String QUERY_API = "/query";
  private static final String UPSERT_API = "/vectors/upsert";
  private static final String DELETE_API = "/vectors/delete";

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final PineconeService pineconeService = retrofit.create(PineconeService.class);
  private ModelMapper modelMapper = new ModelMapper();

  private String originalUrl;
  private String namespace;

  // Getters;
  private WordEmbeddings wordEmbedding;

  private List<WordEmbeddings> wordEmbeddingsList;

  private int topK;

  private EmbeddingEndpoint embeddingEndpoint;

  public PineconeEndpoint() {}

  public PineconeEndpoint(String url, String apiKey, EmbeddingEndpoint embeddingEndpoint) {
    super(url, apiKey);
    this.originalUrl = url;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public PineconeEndpoint(
      String url, String apiKey, EmbeddingEndpoint embeddingEndpoint, RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.embeddingEndpoint = embeddingEndpoint;
    this.originalUrl = url;
  }

  public PineconeEndpoint(
      String url, String apiKey, String namespace, EmbeddingEndpoint embeddingEndpoint) {
    super(url, apiKey);
    this.originalUrl = url;
    this.namespace = namespace;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public PineconeEndpoint(
      String url,
      String apiKey,
      String namespace,
      EmbeddingEndpoint embeddingEndpoint,
      RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.originalUrl = url;
    this.namespace = namespace;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public String getNamespace() {
    return namespace;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }

  // Getters

  public void setOriginalUrl(String originalUrl) {
    this.originalUrl = originalUrl;
  }

  public void setEmbeddingEndpoint(EmbeddingEndpoint embeddingEndpoint) {
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public WordEmbeddings getWordEmbedding() {
    return wordEmbedding;
  }

  public List<WordEmbeddings> getWordEmbeddingsList() {
    return wordEmbeddingsList;
  }

  private void setWordEmbedding(WordEmbeddings wordEmbedding) {
    this.wordEmbedding = wordEmbedding;
  }

  private void setWordEmbeddingsList(List<WordEmbeddings> wordEmbeddingsList) {
    this.wordEmbeddingsList = wordEmbeddingsList;
  }

  public int getTopK() {
    return topK;
  }

  public EmbeddingEndpoint getEmbeddingEndpoint() {
    return embeddingEndpoint;
  }

  public String getOriginalUrl() {
    return originalUrl;
  }

  private void setTopK(int topK) {
    this.topK = topK;
  }

  public StringResponse upsert(WordEmbeddings wordEmbedding, String namespace) {
    PineconeEndpoint mapper = modelMapper.map(this, PineconeEndpoint.class);
    mapper.setWordEmbedding(wordEmbedding);
    mapper.setUrl(mapper.getOriginalUrl().concat(UPSERT_API));
    mapper.setNamespace(namespace);

    return this.pineconeService.upsert(mapper).blockingGet();
  }

  public StringResponse batchUpsert(List<WordEmbeddings> wordEmbeddingsList, String namespace) {
    PineconeEndpoint mapper = modelMapper.map(this, PineconeEndpoint.class);
    mapper.setWordEmbeddingsList(wordEmbeddingsList);
    mapper.setUrl(mapper.getOriginalUrl().concat(UPSERT_API));
    mapper.setNamespace(namespace);

    return this.pineconeService.batchUpsert(mapper).blockingGet();
  }

  public Observable<List<WordEmbeddings>> query(
      String query, String namespace, int topK, ArkRequest arkRequest) {
    WordEmbeddings wordEmbeddings =
        new EdgeChain<>(getEmbeddingEndpoint().embeddings(query, arkRequest)).get();

    PineconeEndpoint mapper = modelMapper.map(this, PineconeEndpoint.class);
    mapper.setWordEmbedding(wordEmbeddings);
    mapper.setUrl(mapper.getOriginalUrl().concat(QUERY_API));
    mapper.setNamespace(namespace);
    mapper.setTopK(topK);
    return Observable.fromSingle(this.pineconeService.query(mapper));
  }

  public StringResponse deleteAll(String namespace) {
    PineconeEndpoint mapper = modelMapper.map(this, PineconeEndpoint.class);
    mapper.setUrl(mapper.getOriginalUrl().concat(DELETE_API));
    mapper.setNamespace(namespace);
    return this.pineconeService.deleteAll(mapper).blockingGet();
  }
}
