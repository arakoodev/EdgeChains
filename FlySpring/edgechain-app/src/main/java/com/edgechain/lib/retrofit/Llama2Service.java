package com.edgechain.lib.retrofit;

import com.edgechain.lib.endpoint.impl.llm.Llama2Endpoint;
import com.edgechain.lib.llama2.response.Llama2ChatCompletionResponse;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface Llama2Service {
    @POST(value = "llama2/chat-completion")
    Single<Llama2ChatCompletionResponse> chatCompletion(@Body Llama2Endpoint llama2Endpoint);
}
