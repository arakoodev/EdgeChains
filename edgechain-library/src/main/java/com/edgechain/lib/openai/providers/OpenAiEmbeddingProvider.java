package com.edgechain.lib.openai.providers;

import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.embeddings.models.WordVec;
import com.edgechain.lib.openai.embeddings.models.openai.OpenAiEmbeddingRequest;
import com.edgechain.lib.openai.embeddings.models.openai.OpenAiEmbeddingResponse;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.openai.utils.JsonUtils;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.databind.ObjectMapper;

public class OpenAiEmbeddingProvider extends ChainProvider {

    private final Endpoint endpoint;

    public OpenAiEmbeddingProvider(Endpoint endpoint) {
        this.endpoint = endpoint;
    }

    @Override
    public EdgeChain<ChainResponse> request(ChainRequest request) {
        return new OpenAiClient()
                .createEmbeddings(endpoint,new OpenAiEmbeddingRequest(endpoint.getModel(),request.getInput()))
                .transform(response -> new ObjectMapper().readValue(response, OpenAiEmbeddingResponse.class))
                .transform(embeddingResponse -> JsonUtils.convertToString(new WordVec(request.getInput(), embeddingResponse.getData().get(0).getEmbedding())))
                .transform(ChainResponse::new);
    }
}
