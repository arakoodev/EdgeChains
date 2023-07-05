package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.openai.request.feign.OpenAiChatRequest;
import com.edgechain.lib.openai.request.feign.OpenAiCompletionRequest;
import com.edgechain.lib.openai.request.feign.OpenAiEmbeddingsRequest;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface OpenAiService {

  @POST(value = "openai/chat-completion")
  Single<ChatCompletionResponse> chatCompletion(@Body OpenAiChatRequest request);

  @POST(value = "openai/completion")
  Single<Completable> completion(@Body OpenAiCompletionRequest request);

  @POST(value = "openai/embeddings")
  Single<OpenAiEmbeddingResponse> embeddings(@Body OpenAiEmbeddingsRequest request);
}
