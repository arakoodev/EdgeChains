package com.edgechain.lib.retrofit;

import com.edgechain.lib.endpoint.impl.llm.LLamaQuickstart;
import com.edgechain.lib.endpoint.impl.llm.Llama2Endpoint;
import com.edgechain.lib.llama2.response.Llama2ChatCompletionResponse;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

import java.util.List;

public interface Llama2Service {
  @POST(value = "llama/chat-completion")
  Single<List<Llama2ChatCompletionResponse>> chatCompletion(@Body Llama2Endpoint llama2Endpoint);

  @POST(value = "llama/chat-completion")
  Single<String> llamaCompletion(@Body LLamaQuickstart lLamaQuickstart);
}
