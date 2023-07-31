package com.edgechain.lib.chains;

import com.edgechain.lib.endpoint.impl.Doc2VecEndpoint;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PostgresRetrieval extends Retrieval {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private final PostgresEndpoint postgresEndpoint;
  private final int dimensions;

  private final ArkRequest arkRequest;

  private OpenAiEndpoint openAiEndpoint;

  private Doc2VecEndpoint doc2VecEndpoint;

  public PostgresRetrieval(
      PostgresEndpoint postgresEndpoint,
      int dimensions,
      OpenAiEndpoint openAiEndpoint,
      ArkRequest arkRequest) {
    this.postgresEndpoint = postgresEndpoint;
    this.dimensions = dimensions;
    this.openAiEndpoint = openAiEndpoint;
    this.arkRequest = arkRequest;
    logger.info("Using OpenAI Embedding Service");
  }

  public PostgresRetrieval(
      PostgresEndpoint postgresEndpoint,
      int dimensions,
      Doc2VecEndpoint doc2VecEndpoint,
      ArkRequest arkRequest) {
    this.postgresEndpoint = postgresEndpoint;
    this.dimensions = dimensions;
    this.doc2VecEndpoint = doc2VecEndpoint;
    this.arkRequest = arkRequest;
    logger.info("Using Doc2Vec Embedding Service");
  }

  @Override
  public void upsert(String input) {

    if (Objects.nonNull(openAiEndpoint)) {
      new EdgeChain<>(
              this.openAiEndpoint
                  .embeddings(input, arkRequest)
                  .map(w -> this.postgresEndpoint.upsert(w, this.dimensions))
                  .firstOrError()
                  .blockingGet())
          .await()
          .blockingAwait();
    }
    // For Doc2Vec ===>

    if (Objects.nonNull(doc2VecEndpoint)) {
      new EdgeChain<>(
              this.doc2VecEndpoint
                  .embeddings(input)
                  .map(embeddings -> this.postgresEndpoint.upsert(embeddings, dimensions))
                  .firstOrError()
                  .blockingGet())
          .await()
          .blockingAwait();
    }
  }
}
