package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.impl.embeddings.OpenAiEmbeddingEndpoint;
import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.openai.response.CompletionResponse;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface OpenAiService {

  @POST(value = "openai/chat-completion")
  Single<ChatCompletionResponse> chatCompletion(@Body OpenAiChatEndpoint OpenAiChatEndpoint);

  @POST(value = "openai/completion")
  Single<CompletionResponse> completion(@Body OpenAiChatEndpoint openAiChatEndpoint);

  @POST(value = "openai/embeddings")
  Single<OpenAiEmbeddingResponse> embeddings(@Body OpenAiEmbeddingEndpoint openAiEmbeddingEndpoint);
}
