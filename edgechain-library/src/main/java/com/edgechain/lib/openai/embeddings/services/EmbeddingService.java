package com.edgechain.lib.openai.embeddings.services;

import com.edgechain.lib.openai.chains.IndexChain;
import com.edgechain.lib.openai.embeddings.models.WordVec;

import java.io.Serializable;


public abstract class EmbeddingService implements Serializable {

    private static final long serialVersionUID = -3410729795509987165L;
    public abstract IndexChain upsert(WordVec wordVec);
    public abstract IndexChain query(WordVec wordVec, int topK);
    public abstract IndexChain delete();

}
