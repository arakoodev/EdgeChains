package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.bgeSmall.response.BgeSmallResponse;
import com.edgechain.lib.endpoint.impl.embeddings.BgeSmallEndpoint;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface BgeSmallService {
  @POST(value = "bgeSmall")
  Single<BgeSmallResponse> embeddings(@Body BgeSmallEndpoint bgeSmallEndpoint);
}
