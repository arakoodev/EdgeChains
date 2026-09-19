package com.edgechain.lib.embeddings.miniLLM.enums;

public enum MiniLMModel {
  ALL_MINILM_L6_V2("all-MiniLM-L6-v2"),
  ALL_MINILM_L12_V2("all-MiniLM-L12-v2"),
  PARAPHRASE_MINILM_L3_V2("paraphrase-MiniLM-L3-v2"),

  MULTI_QA_MINILM_L6_COS_V1("multi-qa-MiniLM-L6-cos-v1");

  private static final String BASE_URL = "djl://ai.djl.huggingface.pytorch/sentence-transformers/";

  private final String name;

  MiniLMModel(String s) {
    this.name = s;
  }

  public String getName() {
    return name;
  }

  public static String getURL(MiniLMModel model) {
    switch (model) {
      case ALL_MINILM_L6_V2 -> {
        return BASE_URL + "all-MiniLM-L6-v2";
      }

      case ALL_MINILM_L12_V2 -> {
        return BASE_URL + "all-MiniLM-L12-v2";
      }

      case PARAPHRASE_MINILM_L3_V2 -> {
        return BASE_URL + "paraphrase-MiniLM-L3-v2";
      }

      case MULTI_QA_MINILM_L6_COS_V1 -> {
        return BASE_URL + "multi-qa-MiniLM-L6-cos-v1";
      }

      default -> {
        return "all-MiniLM-L12-v2";
      }
    }
  }
}
