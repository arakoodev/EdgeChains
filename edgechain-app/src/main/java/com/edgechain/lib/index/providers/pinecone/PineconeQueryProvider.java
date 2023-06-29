package com.edgechain.lib.index.providers.pinecone;

import com.edgechain.lib.embeddings.domain.WordVec;
import com.edgechain.lib.index.services.impl.PineconeIndexChain;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.utils.JsonUtils;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.util.Iterator;

public class PineconeQueryProvider extends ChainProvider {

  private final Endpoint endpoint;
  private final int topK;
  private final String namespace;

  public PineconeQueryProvider(Endpoint endpoint, int topK) {
    this.endpoint = endpoint;
    this.topK = topK;
    this.namespace = "";
  }

  public PineconeQueryProvider(Endpoint endpoint, int topK, String namespace) {
    this.endpoint = endpoint;
    this.topK = topK;
    this.namespace = namespace;
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) { // Getting JsonString & Parsing it

    return new PineconeIndexChain(endpoint, namespace)
        .query(JsonUtils.convertToObject(request.getInput(), WordVec.class), topK)
        .transform(
            w -> {
              Iterator<WordVec> iterator = w.iterator();

              StringBuilder stringBuilder = new StringBuilder();

              while (iterator.hasNext()) {
                stringBuilder.append(iterator.next().getId());
                if (iterator.hasNext()) {
                  stringBuilder.append("\n");
                }
              }

              return new ChainResponse(stringBuilder.toString());
            });
  }
}
