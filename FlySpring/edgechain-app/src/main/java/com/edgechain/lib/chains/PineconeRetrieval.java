package com.edgechain.lib.chains;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.endpoint.impl.MiniLMEndpoint;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;

public class PineconeRetrieval extends Retrieval {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private final PineconeEndpoint pineconeEndpoint;

  private final ArkRequest arkRequest;
  private final Endpoint endpoint;


  public PineconeRetrieval(
      PineconeEndpoint pineconeEndpoint, Endpoint endpoint, ArkRequest arkRequest) {
    this.pineconeEndpoint = pineconeEndpoint;
    this.endpoint = endpoint;
    this.arkRequest = arkRequest;

    if (endpoint instanceof OpenAiEndpoint openAiEndpoint)
      logger.info("Using OpenAi Embedding Service: " + openAiEndpoint.getModel());
    else if (endpoint instanceof MiniLMEndpoint miniLMEndpoint)
      logger.info(String.format("Using %s", miniLMEndpoint.getMiniLMModel().getName()));
  }

  @Override
  public void upsert(String input) {
    if (endpoint instanceof OpenAiEndpoint openAiEndpoint) {
      WordEmbeddings embeddings = openAiEndpoint.embeddings(input, arkRequest);
      this.pineconeEndpoint.upsert(embeddings);
    } else if (endpoint instanceof MiniLMEndpoint miniLMEndpoint) {
      WordEmbeddings embeddings = miniLMEndpoint.embeddings(input, arkRequest);
      this.pineconeEndpoint.upsert(embeddings);
    } else
      throw new RuntimeException(
          "Invalid Endpoint; Only OpenAIEndpoint & MiniLMEndpoint are supported");
  }
}
