package com.edgechain.lib.constants;

import org.deeplearning4j.models.paragraphvectors.ParagraphVectors;

import java.io.InputStream;

public class WebConstants {

  public static final String URI = System.getProperty("uri") + ":" + System.getProperty("server.port");
  public static final String SERVICE_CONTEXT_PATH = "/v2";
  public static ParagraphVectors embeddingDoc2VecModel = null;
  public static InputStream sentenceModel = null;
  public static final String OPENAI_AUTH_KEY = System.getProperty("OPENAI_AUTH_KEY");
  public static final String PINECONE_AUTH_KEY = System.getProperty("PINECONE_AUTH_KEY");

  public static final String OPENAI_CHAT_COMPLETION_API =
      "https://api.openai.com/v1/chat/completions";
  public static final String OPENAI_EMBEDDINGS_API = "https://api.openai.com/v1/embeddings";

  public static final String PINECONE_QUERY_API = System.getProperty("PINECONE_QUERY_API");
  public static final String PINECONE_UPSERT_API = System.getProperty("PINECONE_UPSERT_API");
  public static final String PINECONE_DELETE_API = System.getProperty("PINECONE_DELETE_API");



  public static final String CHAT_STREAM_EVENT_COMPLETION_MESSAGE =
      "OpenAI Chat Completion Finished";
}
