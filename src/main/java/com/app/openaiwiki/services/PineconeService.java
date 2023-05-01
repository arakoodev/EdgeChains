package com.app.openaiwiki.services;

import com.app.openaiwiki.chains.PineconeChain;
import com.app.openaiwiki.flow.PineconeFlow;

import java.util.List;
import java.util.Map;

public interface PineconeService {

    PineconeFlow upsertEmbeddings(List<Map<String, Object>> embeddings);
    PineconeChain searchEmbeddings(List<Double> queryEmbedding, int topK);

}
