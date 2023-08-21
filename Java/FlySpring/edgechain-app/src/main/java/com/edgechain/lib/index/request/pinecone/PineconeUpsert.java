package com.edgechain.lib.index.request.pinecone;

import com.edgechain.lib.embeddings.WordEmbeddings;
import java.util.List;

public class PineconeUpsert {

  List<WordEmbeddings> vectors;
  String namespace;

  public List<WordEmbeddings> getVectors() {
    return vectors;
  }

  public void setVectors(List<WordEmbeddings> vectors) {
    this.vectors = vectors;
  }

  public String getNamespace() {
    return namespace;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }
}
