package com.edgechain.lib.retrofit;

import com.edgechain.lib.context.domain.ContextPutRequest;
import com.edgechain.lib.context.domain.HistoryContext;

import com.edgechain.lib.endpoint.impl.RedisHistoryContextEndpoint;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.*;

public interface RedisContextService {

  @POST(value = "context/create")
  Single<HistoryContext> create(@Query("id") String id, @Body RedisHistoryContextEndpoint endpoint);

  @POST(value = "context/update")
  Single<HistoryContext> put(@Body ContextPutRequest request);

  @POST(value = "context/{id}")
  Single<HistoryContext> get(@Path("id") String id, @Body RedisHistoryContextEndpoint endpoint);

  @POST(value = "context/check/{id}")
  Single<Boolean> check(@Path("id") String id, @Body RedisHistoryContextEndpoint endpoint);

  @HTTP(method = "DELETE", path = "context/{id}", hasBody = true)
  Completable delete(@Path("id") String id, @Body RedisHistoryContextEndpoint endpoint);
}
