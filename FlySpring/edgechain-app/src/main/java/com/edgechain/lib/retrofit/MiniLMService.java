package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.miniLLM.response.MiniLMResponse;

import com.edgechain.lib.endpoint.impl.embeddings.MiniLMEndpoint;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface MiniLMService {

  @POST(value = "miniLM")
  Single<MiniLMResponse> embeddings(@Body MiniLMEndpoint miniLMEndpoint);
}
