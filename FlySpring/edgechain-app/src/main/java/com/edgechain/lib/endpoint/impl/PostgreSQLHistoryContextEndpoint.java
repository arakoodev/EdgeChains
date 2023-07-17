package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.context.domain.ContextPutRequest;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.PostgreSQLContextService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import java.util.Objects;
import retrofit2.Retrofit;

public class PostgreSQLHistoryContextEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final PostgreSQLContextService contextService =
      retrofit.create(PostgreSQLContextService.class);

  public PostgreSQLHistoryContextEndpoint() {}

  public PostgreSQLHistoryContextEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
  }

  public Observable<HistoryContext> create(String id) {
    return Observable.fromSingle(this.contextService.create(id, this));
  }

  public Observable<HistoryContext> put(String id, String response) {
    return Observable.fromSingle(
        this.contextService.put(new ContextPutRequest<>(id, response, this)));
  }

  public Observable<HistoryContext> get(String id) {
    return Observable.fromSingle(this.contextService.get(id, this));
  }

  public void delete(String id) {
    if (Objects.nonNull(id) && !id.isEmpty()) {
      this.contextService.delete(id, this).blockingAwait();
    } else throw new RuntimeException("Redis key cannot be null or empty");
  }
}
