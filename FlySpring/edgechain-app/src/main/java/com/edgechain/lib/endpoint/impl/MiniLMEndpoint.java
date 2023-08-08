package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.embeddings.miniLLM.enums.MiniLMModel;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.MiniLMService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import retrofit2.Retrofit;

public class MiniLMEndpoint extends Endpoint {

  private Logger logger = LoggerFactory.getLogger(MiniLMEndpoint.class);

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final MiniLMService miniLMService = retrofit.create(MiniLMService.class);

  private String input;

  private MiniLMModel miniLMModel;

  private String callIdentifier;

  public MiniLMEndpoint() {}

  public MiniLMEndpoint(MiniLMModel miniLMModel) {
    this.miniLMModel = miniLMModel;
  }

  public String getInput() {
    return input;
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

  public WordEmbeddings embeddings(String input, ArkRequest arkRequest) {

    this.input = input; // set Input

    if (Objects.nonNull(arkRequest)) {
      this.callIdentifier = arkRequest.getRequestURI();
    }

    return miniLMService
        .embeddings(this)
        .map(m -> new WordEmbeddings(input, m.getEmbedding()))
        .blockingGet();
  }
}
