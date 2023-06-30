package com.edgechain.lib.embeddings.providers;

import com.edgechain.lib.embeddings.domain.WordVec;
import com.edgechain.lib.embeddings.domain.openai.OpenAiEmbeddingRequest;
import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.utils.JsonUtils;

public class OpenAiEmbeddingProvider extends ChainProvider {

  private final Endpoint endpoint;

  public OpenAiEmbeddingProvider(Endpoint endpoint) {
    this.endpoint = endpoint;
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) {
    return new OpenAiClient()
        .createEmbeddings(
            endpoint, new OpenAiEmbeddingRequest(endpoint.getModel(), request.getInput()))
        .transform(
            embeddingResponse ->
                JsonUtils.convertToString(
                    new WordVec(
                        request.getInput(), embeddingResponse.getData().get(0).getEmbedding())))
        .transform(ChainResponse::new);
  }
}
