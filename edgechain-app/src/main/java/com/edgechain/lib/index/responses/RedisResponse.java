package com.edgechain.lib.index.responses;

import java.util.ArrayList;

public class RedisResponse {

  private int totalResults;
  private ArrayList<RedisDocument> documents;

  public int getTotalResults() {
    return totalResults;
  }

  public void setTotalResults(int totalResults) {
    this.totalResults = totalResults;
  }

  public ArrayList<RedisDocument> getDocuments() {
    return documents;
  }

  public void setDocuments(ArrayList<RedisDocument> documents) {
    this.documents = documents;
  }
}
