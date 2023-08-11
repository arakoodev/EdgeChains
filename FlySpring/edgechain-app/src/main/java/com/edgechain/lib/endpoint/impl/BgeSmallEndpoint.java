package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.BgeSmallService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import retrofit2.Retrofit;

import java.util.Objects;

public class BgeSmallEndpoint extends Endpoint {

  private Logger logger = LoggerFactory.getLogger(BgeSmallEndpoint.class);

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final BgeSmallService bgeSmallService = retrofit.create(BgeSmallService.class);

  private String input;

  private String modelPath;

  private String callIdentifier;

  public BgeSmallEndpoint() {}

  public BgeSmallEndpoint(String modelPath) {
    this.modelPath = modelPath;
  }

  public String getModelPath() {
    return modelPath;
  }

  public String getInput() {
    return input;
  }


  public String getCallIdentifier() {
    return callIdentifier;
  }

  public BgeSmallEndpoint(RetryPolicy retryPolicy, String modelPath) {
    super(retryPolicy);
    this.modelPath = modelPath;
  }

  public WordEmbeddings embeddings(String input, ArkRequest arkRequest) {

    this.input = input; // set Input

    if (Objects.nonNull(arkRequest)) {
      this.callIdentifier = arkRequest.getRequestURI();
    }

    return bgeSmallService
        .embeddings(this)
        .map(m -> new WordEmbeddings(input, m.getEmbedding()))
        .blockingGet();
  }
}
