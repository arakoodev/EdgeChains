package com.edgechain.lib.chains;

import com.edgechain.lib.chains.retrieval.Retrieval;
import com.edgechain.lib.feign.EmbeddingService;
import com.edgechain.lib.feign.index.PineconeService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.Doc2VecEmbeddingsRequest;
import com.edgechain.lib.request.OpenAiEmbeddingsRequest;
import static com.edgechain.lib.rxjava.transformer.observable.EdgeChain.create;

import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PineconeRetrieval extends Retrieval {


    private final Logger logger = LoggerFactory.getLogger(getClass());

    private final Endpoint indexEndpoint;
    private Endpoint embeddingEndpoint;

    private final EmbeddingService embeddingService;

    private final PineconeService pineconeService;

    // OpenAI
    public PineconeRetrieval(Endpoint indexEndpoint, Endpoint embeddingEndpoint, EmbeddingService embeddingService, PineconeService pineconeService) {
        this.indexEndpoint = indexEndpoint;
        this.embeddingEndpoint = embeddingEndpoint;
        this.embeddingService = embeddingService;
        this.pineconeService = pineconeService;
        logger.info("Using OpenAI Embedding Provider.");
    }

    // Doc2Vec
    public PineconeRetrieval(Endpoint indexEndpoint, EmbeddingService embeddingService, PineconeService pineconeService) {
        this.indexEndpoint = indexEndpoint;
        this.embeddingService = embeddingService;
        this.pineconeService = pineconeService;
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

        edgeChain.transform(
                embeddingOutput ->
                        this.pineconeService
                                .upsert(new PineconeRequest(this.indexEndpoint, embeddingOutput))
                                .getResponse())
                .awaitWithoutRetry();

    }
}
