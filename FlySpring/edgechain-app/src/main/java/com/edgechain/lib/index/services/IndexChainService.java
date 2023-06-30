package com.edgechain.lib.index.services;

import com.edgechain.lib.embeddings.domain.WordVec;
import com.edgechain.lib.openai.chains.IndexChain;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.io.Serializable;
import java.util.List;

public abstract class IndexChainService implements Serializable {

  private static final long serialVersionUID = -3410729795509987165L;

  public abstract IndexChain upsert(WordVec wordVec);

  public abstract EdgeChain<List<WordVec>> query(WordVec wordVec, int topK);

  public abstract IndexChain deleteByIds(List<String> vectorIds);

  public abstract IndexChain deleteAll();
}
