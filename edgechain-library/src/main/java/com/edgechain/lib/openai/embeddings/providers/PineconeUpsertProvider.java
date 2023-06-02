package com.edgechain.lib.openai.embeddings.providers;

import com.edgechain.lib.openai.embeddings.models.WordVec;
import com.edgechain.lib.openai.embeddings.services.impl.PineconeEmbedding;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.openai.utils.JsonUtils;
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
    return new PineconeEmbedding(endpoint, namespace)
        .upsert(JsonUtils.convertToObject(request.getInput(), WordVec.class));
  }
}
