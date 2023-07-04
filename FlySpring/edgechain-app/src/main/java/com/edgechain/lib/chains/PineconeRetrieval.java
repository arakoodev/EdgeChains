package com.edgechain.lib.chains;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PineconeRetrieval extends Retrieval {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private final PineconeEndpoint pineconeEndpoint;
  private OpenAiEndpoint openAiEndpoint;

  public PineconeRetrieval(PineconeEndpoint pineconeEndpoint, OpenAiEndpoint openAiEndpoint) {
    this.pineconeEndpoint = pineconeEndpoint;
    this.openAiEndpoint = openAiEndpoint;
    logger.info("Using OpenAI Embedding Service");
  }

  public PineconeRetrieval(PineconeEndpoint pineconeEndpoint) {
    this.pineconeEndpoint = pineconeEndpoint;
    logger.info("Using Doc2Vec Embedding Service");
  }

  @Override
  public void upsert(String input) {

    if (openAiEndpoint != null) {
      new EdgeChain<>(
              this.openAiEndpoint
                  .getEmbeddings(input)
                  .map(this.pineconeEndpoint::upsert)
                  .firstOrError()
                  .blockingGet())
          .await()
          .blockingAwait();
    }
    // For Doc2Vec ===>
  }
}
