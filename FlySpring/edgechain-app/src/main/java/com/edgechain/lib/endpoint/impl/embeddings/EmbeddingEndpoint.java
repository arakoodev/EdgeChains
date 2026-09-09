package com.edgechain.lib.endpoint.impl.embeddings;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import io.reactivex.rxjava3.core.Observable;

import java.io.Serializable;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
  @JsonSubTypes.Type(value = OpenAiEmbeddingEndpoint.class, name = "type1"),
  @JsonSubTypes.Type(value = MiniLMEndpoint.class, name = "type2"),
  @JsonSubTypes.Type(value = BgeSmallEndpoint.class, name = "type3"),
})
public abstract class EmbeddingEndpoint extends Endpoint implements Serializable {

  private static final long serialVersionUID = 4201794264326630184L;
  private String callIdentifier;
  private String rawText;

  public EmbeddingEndpoint() {}

  public EmbeddingEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
  }

  public EmbeddingEndpoint(String url) {
    super(url);
  }

  public EmbeddingEndpoint(String url, RetryPolicy retryPolicy) {
    super(url, retryPolicy);
  }

  public EmbeddingEndpoint(String url, String apiKey) {
    super(url, apiKey);
  }

  public EmbeddingEndpoint(String url, String apiKey, RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
  }

  public abstract Observable<WordEmbeddings> embeddings(String input, ArkRequest arkRequest);

  public void setRawText(String rawText) {
    this.rawText = rawText;
  }

  public void setCallIdentifier(String callIdentifier) {
    this.callIdentifier = callIdentifier;
  }

  public String getRawText() {
    return rawText;
  }

  public String getCallIdentifier() {
    return callIdentifier;
  }
}
