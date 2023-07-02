package com.edgechain.lib.chains;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PineconeRetrieval extends Retrieval {

  private Logger logger = LoggerFactory.getLogger(getClass());

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
  public void upsert(String input, String namespace) {

    if (openAiEndpoint != null) {
      new EdgeChain<>(
              this.openAiEndpoint
                  .getEmbeddings(input)
                  .map(embeddings -> this.pineconeEndpoint.upsert(embeddings, namespace)))
          .awaitWithoutRetry();
    }
    // For Doc2Vec ===>
  }
}
