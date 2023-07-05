package com.edgechain.lib.index.request.feign;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.index.enums.RedisDistanceMetric;

public class RedisRequest {

  private RedisEndpoint endpoint;
  private WordEmbeddings wordEmbeddings;

  private String indexName;
  private String namespace;

  private int dimensions;

  private RedisDistanceMetric metric;

  private int topK;

  public RedisRequest() {}

  public int getTopK() {
    return topK;
  }

  public void setTopK(int topK) {
    this.topK = topK;
  }

  public RedisEndpoint getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(RedisEndpoint endpoint) {
    this.endpoint = endpoint;
  }

  public WordEmbeddings getWordEmbeddings() {
    return wordEmbeddings;
  }

  public void setWordEmbeddings(WordEmbeddings wordEmbeddings) {
    this.wordEmbeddings = wordEmbeddings;
  }

  public String getNamespace() {
    return namespace;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }

  public String getIndexName() {
    return indexName;
  }

  public void setIndexName(String indexName) {
    this.indexName = indexName;
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

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("RedisRequest{");
    sb.append("wordEmbeddings=").append(wordEmbeddings);
    sb.append(", indexName='").append(indexName).append('\'');
    sb.append(", namespace='").append(namespace).append('\'');
    sb.append(", dimensions=").append(dimensions);
    sb.append(", topK=").append(topK);
    sb.append('}');
    return sb.toString();
  }
}
