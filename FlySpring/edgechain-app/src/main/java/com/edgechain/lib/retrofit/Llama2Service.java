package com.edgechain.lib.retrofit;

import com.edgechain.lib.endpoint.impl.llama2.Llama2Endpoint;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface Llama2Service {
    @POST(value = "llama2/chat-completion")
    Single<ChatCompletionResponse> chatCompletion(@Body Llama2Endpoint llama2Endpoint);

    @POST(value = "llama2/completion")
    Single<Completable> completion(@Body Llama2Endpoint llama2Endpoint);
}
