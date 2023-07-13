package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.response.OpenAiEmbeddingResponse;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface OpenAiService {

  @POST(value = "openai/chat-completion")
  Single<ChatCompletionResponse> chatCompletion(@Body OpenAiEndpoint openAiEndpoint);

  @POST(value = "openai/completion")
  Single<Completable> completion(@Body OpenAiEndpoint openAiEndpoint);

  @POST(value = "openai/embeddings")
  Single<OpenAiEmbeddingResponse> embeddings(@Body OpenAiEndpoint openAiEndpoint);
}
