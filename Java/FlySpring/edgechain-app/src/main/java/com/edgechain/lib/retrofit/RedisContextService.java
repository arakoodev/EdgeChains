package com.edgechain.lib.retrofit;

import com.edgechain.lib.context.domain.ContextPutRequest;
import com.edgechain.lib.context.domain.HistoryContext;

import com.edgechain.lib.endpoint.impl.context.RedisHistoryContextEndpoint;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.*;

public interface RedisContextService {

  @POST(value = "context/redis/create")
  Single<HistoryContext> create(@Query("id") String id, @Body RedisHistoryContextEndpoint endpoint);

  @POST(value = "context/redis/update")
  Single<HistoryContext> put(@Body ContextPutRequest request);

  @POST(value = "context/redis/{id}")
  Single<HistoryContext> get(@Path("id") String id, @Body RedisHistoryContextEndpoint endpoint);

  @HTTP(method = "DELETE", path = "context/redis/{id}", hasBody = true)
  Completable delete(@Path("id") String id, @Body RedisHistoryContextEndpoint endpoint);
}
