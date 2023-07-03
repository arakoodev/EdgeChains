package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.feign.RedisContextService;
import com.edgechain.lib.feign.RedisService;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.index.request.feign.RedisRequest;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.retry.RetryPolicy;

import java.util.HashMap;
import java.util.List;
import java.util.Objects;

public class RedisEndpoint extends Endpoint {

    private final RedisContextService contextService = ApplicationContextHolder.getContext().getBean(RedisContextService.class);
    private final RedisService redisService = ApplicationContextHolder.getContext().getBean(RedisService.class);

    private String indexName;
    private String namespace;

    public RedisEndpoint() {
    }

    public RedisEndpoint(RetryPolicy retryPolicy) {
        super(retryPolicy);
    }

    public RedisEndpoint(String indexName, String namespace) {
        this.indexName = indexName;
        this.namespace = namespace;
    }

    public RedisEndpoint(RetryPolicy retryPolicy, String indexName, String namespace) {
        super(retryPolicy);
        this.indexName = indexName;
        this.namespace = namespace;
    }


    public StringResponse upsert(WordEmbeddings wordEmbeddings, int dimension, RedisDistanceMetric metric) {

        RedisRequest request = new RedisRequest();
        request.setEndpoint(this);
        request.setWordEmbeddings(wordEmbeddings);
        request.setIndexName(this.indexName);
        request.setNamespace(this.namespace);
        request.setDimensions(dimension);
        request.setMetric(metric);

        return this.redisService.upsert(request);
    }

    public List<WordEmbeddings> query(WordEmbeddings embeddings,int topK){

        RedisRequest request = new RedisRequest();
        request.setTopK(topK);
        request.setWordEmbeddings(embeddings);
        request.setIndexName(this.indexName);
        request.setNamespace(this.namespace);
        request.setEndpoint(this);

        return this.redisService.query(request);
    }

    public void delete(String patternName) {
        HashMap<String,String> mapper = new HashMap<>();
        mapper.put("pattern", patternName);
        this.redisService.deleteByPattern(mapper);
    }

    public HistoryContext createHistoryContext(String key) {
        return contextService.create();
    }

    public HistoryContext updateHistoryContext(String key, String response) {

        HashMap<String,String> mapper = new HashMap<>();
        mapper.put("key", key);
        mapper.put("response", response);

       return this.contextService.update(mapper);
    }

    public HistoryContext getHistoryContext(String key) {
        return this.contextService.get(key);
    }

    public boolean checkHistoryContext(String key) {
        if( Objects.nonNull(key) && !key.isEmpty()) {
            return this.contextService.check(key);
        }
        return false;
    }
}
