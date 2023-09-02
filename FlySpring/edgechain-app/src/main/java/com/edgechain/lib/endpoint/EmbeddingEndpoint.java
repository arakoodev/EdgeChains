package com.edgechain.lib.endpoint;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;

public abstract class EmbeddingEndpoint extends Endpoint {

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

  public String getRawText() {
    return rawText;
  }
}
