package com.edgechain.lib.chains;

import com.edgechain.lib.chains.retrieval.Retrieval;
import com.edgechain.lib.feign.EmbeddingService;
import com.edgechain.lib.feign.index.PineconeService;
import com.edgechain.lib.feign.index.RedisService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.Doc2VecEmbeddingsRequest;
import com.edgechain.lib.request.OpenAiEmbeddingsRequest;
import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.request.RedisRequest;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static com.edgechain.lib.rxjava.transformer.observable.EdgeChain.create;

public class RedisRetrieval extends Retrieval {

    private final Logger logger = LoggerFactory.getLogger(getClass());

    private Endpoint embeddingEndpoint;
    private Endpoint chatEndpoint;
    private final EmbeddingService embeddingService;
    private final RedisService redisService;

    // For OpenAI
    public RedisRetrieval(
            Endpoint embeddingEndpoint, EmbeddingService embeddingService, RedisService redisService) {
        this.embeddingEndpoint = embeddingEndpoint;
        this.embeddingService = embeddingService;
        this.redisService = redisService;
        logger.info("Using OpenAI Embedding Provider");
    }


    public RedisRetrieval(EmbeddingService embeddingService, RedisService redisService) {
        this.embeddingService = embeddingService;
        this.redisService = redisService;
        logger.info("Using Doc2Vec Embedding Provider");
    }


    @Override
    public void upsert(String input) {
        EdgeChain<String> edgeChain;

        if (embeddingEndpoint != null) {
            edgeChain = create(
                    this.embeddingService
                            .openAi(new OpenAiEmbeddingsRequest(this.embeddingEndpoint, input))
                            .getResponse());

        } else {
            edgeChain = create(
                    this.embeddingService
                            .doc2Vec(new Doc2VecEmbeddingsRequest(input))
                            .getResponse()
            );
        }

    edgeChain
        .transform(
            embeddingOutput ->
                this.redisService
                    .upsert(new RedisRequest(embeddingOutput))
                    .getResponse())
        .awaitWithoutRetry();
    }
}
