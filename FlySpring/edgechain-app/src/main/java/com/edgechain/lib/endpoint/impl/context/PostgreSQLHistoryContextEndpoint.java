package com.edgechain.lib.endpoint.impl.context;

import com.edgechain.lib.context.domain.ContextPutRequest;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.PostgreSQLContextService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
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

  public HistoryContext create(String id) {
    return this.contextService.create(id, this).blockingGet();
  }

  public HistoryContext put(String id, String response) {
    return this.contextService.put(new ContextPutRequest<>(id, response, this)).blockingGet();
  }

  public HistoryContext get(String id) {
    return this.contextService.get(id, this).blockingGet();
  }

  public void delete(String id) {
    if (Objects.nonNull(id) && !id.isEmpty()) {
      this.contextService.delete(id, this).blockingAwait();
    } else throw new RuntimeException("Redis key cannot be null or empty");
  }
}
