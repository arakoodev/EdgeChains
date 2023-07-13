package com.edgechain.lib.chains;

import com.edgechain.lib.endpoint.impl.Doc2VecEndpoint;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;

public class PineconeRetrieval extends Retrieval {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private final PineconeEndpoint pineconeEndpoint;
  private OpenAiEndpoint openAiEndpoint;

  private Doc2VecEndpoint doc2VecEndpoint;

  public PineconeRetrieval(PineconeEndpoint pineconeEndpoint, OpenAiEndpoint openAiEndpoint) {
    this.pineconeEndpoint = pineconeEndpoint;
    this.openAiEndpoint = openAiEndpoint;
    logger.info("Using OpenAI Embedding Service");
  }

  public PineconeRetrieval(PineconeEndpoint pineconeEndpoint, Doc2VecEndpoint doc2VecEndpoint) {
    this.pineconeEndpoint = pineconeEndpoint;
    this.doc2VecEndpoint = doc2VecEndpoint;
    logger.info("Using Doc2Vec Embedding Service");
  }

  @Override
  public void upsert(String input) {

    if (Objects.nonNull(openAiEndpoint)) {
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

    if (Objects.nonNull(doc2VecEndpoint)) {
      new EdgeChain<>(
              this.doc2VecEndpoint
                  .getEmbeddings(input)
                  .map(this.pineconeEndpoint::upsert)
                  .firstOrError()
                  .blockingGet())
          .await()
          .blockingAwait();
    }
  }
}
