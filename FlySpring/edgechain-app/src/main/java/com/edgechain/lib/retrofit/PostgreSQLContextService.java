package com.edgechain.lib.retrofit;

import com.edgechain.lib.context.domain.ContextPutRequest;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.impl.context.PostgreSQLHistoryContextEndpoint;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.*;

public interface PostgreSQLContextService {

  @POST(value = "context/postgresql/create")
  Single<HistoryContext> create(
      @Query("id") String id, @Body PostgreSQLHistoryContextEndpoint endpoint);

  @POST(value = "context/postgresql/update")
  Single<HistoryContext> put(@Body ContextPutRequest request);

  @POST(value = "context/postgresql/{id}")
  Single<HistoryContext> get(
      @Path("id") String id, @Body PostgreSQLHistoryContextEndpoint endpoint);

  @HTTP(method = "DELETE", path = "context/postgresql/{id}", hasBody = true)
  Completable delete(@Path("id") String id, @Body PostgreSQLHistoryContextEndpoint endpoint);
}
