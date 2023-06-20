package com.edgechain.app.constants;

import java.io.InputStream;

public class WebConstants {

  public static InputStream sentenceModel = null;
  public static final String OPENAI_AUTH_KEY = System.getenv("OPENAI_AUTH_KEY");
  public static final String PINECONE_AUTH_KEY = System.getenv("PINECONE_AUTH_KEY");

  public static final String OPENAI_CHAT_COMPLETION_API = System.getenv("OPENAI_CHAT_COMPLETION_API");
  public static final String OPENAI_EMBEDDINGS_API = System.getenv("OPENAI_EMBEDDINGS_API");

  public static final String PINECONE_QUERY_API = System.getenv("PINECONE_QUERY_API");
  public static final String PINECONE_UPSERT_API = System.getenv("PINECONE_UPSERT_API");
  public static final String PINECONE_DELETE_API = System.getenv("PINECONE_DELETE_API");
  public static final String JSONNET_LOCATION = System.getenv("JSONNET_LOCATION");
}
