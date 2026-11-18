package com.app.openai.embeddings.service;

import com.app.openai.chains.IndexChain;
import com.app.openai.embeddings.WordVec;

import java.io.Serializable;

public abstract class EmbeddingService implements Serializable {

  private static final long serialVersionUID = -3410729795509987165L;

  public abstract IndexChain upsert(WordVec wordVec);

  public abstract IndexChain predict(String query, String OPENAI_API_KEY);

  public abstract IndexChain predict(String query, Double temperature, String OPENAI_API_KEY);

  public abstract IndexChain delete();
}
