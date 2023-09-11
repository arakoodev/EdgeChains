package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.embeddings.miniLLM.enums.MiniLMModel;
import com.edgechain.lib.endpoint.EmbeddingEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.MiniLMService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import java.util.Objects;

import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import retrofit2.Retrofit;

public class MiniLMEndpoint extends EmbeddingEndpoint {

  private Logger logger = LoggerFactory.getLogger(MiniLMEndpoint.class);

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final MiniLMService miniLMService = retrofit.create(MiniLMService.class);

  private MiniLMModel miniLMModel;

  private String callIdentifier;

  public MiniLMEndpoint() {}

  public MiniLMEndpoint(MiniLMModel miniLMModel) {
    this.miniLMModel = miniLMModel;
  }

  public MiniLMModel getMiniLMModel() {
    return miniLMModel;
  }

  public String getCallIdentifier() {
    return callIdentifier;
  }

  public MiniLMEndpoint(RetryPolicy retryPolicy, MiniLMModel miniLMModel) {
    super(retryPolicy);
    this.miniLMModel = miniLMModel;
  }

  @Override
  public Observable<WordEmbeddings> embeddings(String input, ArkRequest arkRequest) {
    setRawText(input);

    if (Objects.nonNull(arkRequest)) this.callIdentifier = arkRequest.getRequestURI();
    else this.callIdentifier = "URI wasn't provided";

    if (Objects.nonNull(arkRequest)) {
      this.callIdentifier = arkRequest.getRequestURI();
    }

    return Observable.fromSingle(
        miniLMService.embeddings(this).map(m -> new WordEmbeddings(input, m.getEmbedding())));
  }
}
