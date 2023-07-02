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

    private final String namespace;
    private final PineconeService pineconeService = ApplicationContextHolder.getContext().getBean(PineconeService.class);

    public PineconeEndpoint(String namespace) {
        if(Objects.isNull(namespace) || namespace.isEmpty()) this.namespace = "";
        else  this.namespace = namespace;
    }

    public PineconeEndpoint(String url, String apiKey, String namespace) {
        super(url, apiKey);
        if(Objects.isNull(namespace) || namespace.isEmpty()) this.namespace = "";
        else  this.namespace = namespace;
    }

    public PineconeEndpoint(String url, String apiKey, String namespace, RetryPolicy retryPolicy) {
        super(url, apiKey, retryPolicy);
        if(Objects.isNull(namespace) || namespace.isEmpty()) this.namespace = "";
        else  this.namespace = namespace;
    }

    /* For OpenAI */
    public StringResponse upsert(WordEmbeddings wordEmbeddings, String namespace) {

        PineconeRequest request = new PineconeRequest();
        request.setEndpoint(this);
        request.setWordEmbeddings(wordEmbeddings);
        request.setNamespace(namespace);

        return this.pineconeService.upsert(request);
    }

    public List<WordEmbeddings> query(WordEmbeddings embeddings,String namespace, int topK) {
        PineconeRequest request = new PineconeRequest();
        request.setEndpoint(this);
        request.setWordEmbeddings(embeddings);
        request.setNamespace(namespace);
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
