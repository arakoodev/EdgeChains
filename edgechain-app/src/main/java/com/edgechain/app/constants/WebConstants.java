package com.edgechain.app.constants;

import java.io.InputStream;

import org.springframework.beans.factory.annotation.Value;

public class WebConstants {
  public static InputStream sentenceModel = null;

  public static final String OPENAI_CHAT_COMPLETION_API = "https://api.openai.com/v1/chat/completions";
  public static final String OPENAI_EMBEDDINGS_API = "https://api.openai.com/v1/embeddings";

  public static final String OPENAI_AUTH_KEY = System.getProperty("openai.api.key");
  public static final String PINECONE_AUTH_KEY = System.getProperty("pinecone.api.key");
  public static final String PINECONE_QUERY_API = System.getProperty("pinecone.api.query");
  public static final String PINECONE_UPSERT_API = System.getProperty("pinecone.api.upsert");
  public static final String PINECONE_DELETE_API = System.getProperty("pinecone.api.delete");

  public static String JSONNET_LOCATION = System.getProperty("jsonnet.target.location");
}
