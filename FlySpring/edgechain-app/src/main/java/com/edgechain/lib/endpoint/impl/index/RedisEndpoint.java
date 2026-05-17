package com.edgechain.lib.endpoint.impl.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.endpoint.impl.embeddings.EmbeddingEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.RedisService;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;
import java.util.List;

public class RedisEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final RedisService redisService = retrofit.create(RedisService.class);

  private ModelMapper modelMapper = new ModelMapper();

  private String indexName;
  private String namespace;

  // Getters;
  private WordEmbeddings wordEmbedding;
  private List<WordEmbeddings> wordEmbeddingsList;

  private int dimensions;

  private RedisDistanceMetric metric;

  private int topK;

  private String pattern;

  private EmbeddingEndpoint embeddingEndpoint;

  public RedisEndpoint() {}

  public RedisEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
  }

  public RedisEndpoint(String indexName, EmbeddingEndpoint embeddingEndpoint) {
    this.indexName = indexName;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public RedisEndpoint(
      String indexName, EmbeddingEndpoint embeddingEndpoint, RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.indexName = indexName;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public RedisEndpoint(String indexName, String namespace, EmbeddingEndpoint embeddingEndpoint) {
    this.indexName = indexName;
    this.namespace = namespace;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public RedisEndpoint(
      String indexName,
      String namespace,
      EmbeddingEndpoint embeddingEndpoint,
      RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.indexName = indexName;
    this.namespace = namespace;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public EmbeddingEndpoint getEmbeddingEndpoint() {
    return embeddingEndpoint;
  }

  public void setEmbeddingEndpoint(EmbeddingEndpoint embeddingEndpoint) {
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public void setPattern(String pattern) {
    this.pattern = pattern;
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

  public void setWordEmbedding(WordEmbeddings wordEmbedding) {
    this.wordEmbedding = wordEmbedding;
  }

  public int getDimensions() {
    return dimensions;
  }

  public void setDimensions(int dimensions) {
    this.dimensions = dimensions;
  }

  public void setWordEmbeddingsList(List<WordEmbeddings> wordEmbeddingsList) {
    this.wordEmbeddingsList = wordEmbeddingsList;
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
    RedisEndpoint mapper = modelMapper.map(this, RedisEndpoint.class);
    mapper.setDimensions(dimension);
    mapper.setMetric(metric);
    mapper.setNamespace(namespace);

    return this.redisService.createIndex(mapper).blockingGet();
  }

  public void batchUpsert(List<WordEmbeddings> wordEmbeddingsList) {
    RedisEndpoint mapper = modelMapper.map(this, RedisEndpoint.class);
    mapper.setWordEmbeddingsList(wordEmbeddingsList);

    this.redisService.batchUpsert(mapper).ignoreElement().blockingAwait();
  }

  public StringResponse upsert(WordEmbeddings wordEmbedding) {
    RedisEndpoint mapper = modelMapper.map(this, RedisEndpoint.class);
    mapper.setWordEmbedding(wordEmbedding);

    return this.redisService.upsert(mapper).blockingGet();
  }

  public Observable<List<WordEmbeddings>> query(String input, int topK, ArkRequest arkRequest) {

    WordEmbeddings wordEmbedding =
        new EdgeChain<>(embeddingEndpoint.embeddings(input, arkRequest)).get();

    RedisEndpoint mapper = modelMapper.map(this, RedisEndpoint.class);
    mapper.setTopK(topK);
    mapper.setWordEmbedding(wordEmbedding);
    return Observable.fromSingle(this.redisService.query(mapper));
  }

  public void delete(String patternName) {
    RedisEndpoint mapper = modelMapper.map(this, RedisEndpoint.class);
    mapper.setPattern(patternName);
    this.redisService.deleteByPattern(mapper).blockingAwait();
  }
}
