package com.edgechain.lib.chains;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.endpoint.impl.MiniLMEndpoint;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.request.ArkRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PostgresRetrieval extends Retrieval {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private final PostgresEndpoint postgresEndpoint;
  private final int dimensions;


  private final String filename;

  private final ArkRequest arkRequest;

  private final Endpoint endpoint;


  public PostgresRetrieval(
          PostgresEndpoint postgresEndpoint,
          String filename,
          int dimensions,
          Endpoint endpoint,
          ArkRequest arkRequest) {
    this.postgresEndpoint = postgresEndpoint;
    this.dimensions = dimensions;
    this.filename = filename;
    this.endpoint = endpoint;
    this.arkRequest = arkRequest;

    if(endpoint instanceof OpenAiEndpoint openAiEndpoint)
      logger.info("Using OpenAi Embedding Service: "+openAiEndpoint.getModel());

    else if(endpoint instanceof MiniLMEndpoint miniLMEndpoint)
      logger.info(String.format("Using %s",miniLMEndpoint.getMiniLMModel().getName()));

  }


  @Override
  public void upsert(String input) {

    if(endpoint instanceof OpenAiEndpoint openAiEndpoint) {
      WordEmbeddings embeddings =  openAiEndpoint.embeddings(input, arkRequest) ;
      this.postgresEndpoint.upsert(embeddings,this.filename, this.dimensions);
    }
    else if(endpoint instanceof MiniLMEndpoint miniLMEndpoint) {
      WordEmbeddings embeddings =  miniLMEndpoint.embeddings(input, arkRequest) ;
      this.postgresEndpoint.upsert(embeddings,this.filename, this.dimensions);
    }

    else
      throw new RuntimeException("Invalid Endpoint; Only OpenAIEndpoint & MiniLMEndpoint are supported");


  }
}
