package com.edgechain.lib.index.providers.pinecone;

import com.edgechain.lib.index.services.impl.PineconeIndexChain;
import com.edgechain.lib.embeddings.domain.WordVec;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.utils.JsonUtils;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

public class PineconeUpsertProvider extends ChainProvider {

  private final Endpoint endpoint;
  private final String namespace;

  public PineconeUpsertProvider(Endpoint endpoint) {
    this.endpoint = endpoint;
    this.namespace = "";
  }

  public PineconeUpsertProvider(Endpoint endpoint, String namespace) {
    this.endpoint = endpoint;
    this.namespace = namespace;
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) {
    return new PineconeIndexChain(endpoint, namespace)
        .upsert(JsonUtils.convertToObject(request.getInput(), WordVec.class));
  }
}
