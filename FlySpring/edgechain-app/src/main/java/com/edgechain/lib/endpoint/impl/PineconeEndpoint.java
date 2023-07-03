package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.feign.PineconeService;
import com.edgechain.lib.index.request.feign.PineconeRequest;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.retry.RetryPolicy;

import java.util.List;
import java.util.Objects;

public class PineconeEndpoint extends Endpoint {

    private String namespace;
    private final PineconeService pineconeService = ApplicationContextHolder.getContext().getBean(PineconeService.class);

    public PineconeEndpoint() {
    }

    public PineconeEndpoint(String namespace) {
        this.namespace = namespace;
    }

    public PineconeEndpoint(String url, String apiKey, String namespace) {
        super(url, apiKey);
        this.namespace = namespace;
    }

    public PineconeEndpoint(String url, String apiKey, String namespace, RetryPolicy retryPolicy) {
        super(url, apiKey, retryPolicy);
        this.namespace = namespace;
    }

    public StringResponse upsert(WordEmbeddings wordEmbeddings) {

        PineconeRequest request = new PineconeRequest();
        request.setEndpoint(this);
        request.setWordEmbeddings(wordEmbeddings);
        request.setNamespace(this.namespace);

        return this.pineconeService.upsert(request);
    }

    public List<WordEmbeddings> query(WordEmbeddings embeddings,int topK) {
        PineconeRequest request = new PineconeRequest();
        request.setEndpoint(this);
        request.setWordEmbeddings(embeddings);
        request.setNamespace(this.namespace);
        request.setTopK(topK);

        return this.pineconeService.query(request);
    }


    public StringResponse deleteAll() {

        PineconeRequest request = new PineconeRequest();
        request.setEndpoint(this);
        request.setNamespace(this.namespace);

        return pineconeService.deleteAll(request);
    }
}
