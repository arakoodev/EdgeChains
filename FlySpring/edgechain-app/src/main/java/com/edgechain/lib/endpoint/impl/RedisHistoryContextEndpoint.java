package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.context.domain.ContextPutRequest;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.RedisContextService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;

import java.util.Objects;

public class RedisHistoryContextEndpoint extends Endpoint {

  public RedisHistoryContextEndpoint() {}

  public RedisHistoryContextEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
  }

  public Observable<HistoryContext> create(String id) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    RedisContextService contextService = retrofit.create(RedisContextService.class);

    return Observable.fromSingle(contextService.create(id, this));
  }

  public Observable<HistoryContext> put(String id, String response) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    RedisContextService contextService = retrofit.create(RedisContextService.class);

    return Observable.fromSingle(contextService.put(new ContextPutRequest(id, response, this)));
  }

  public Observable<HistoryContext> get(String id) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    RedisContextService contextService = retrofit.create(RedisContextService.class);

    return Observable.fromSingle(contextService.get(id, this));
  }

  public Observable<Boolean> check(String id) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    RedisContextService contextService = retrofit.create(RedisContextService.class);

    if (Objects.nonNull(id) && !id.isEmpty()) {
      return Observable.fromSingle(contextService.check(id, this));
    }
    return Observable.just(false);
  }

  public void delete(String id) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    RedisContextService contextService = retrofit.create(RedisContextService.class);

    if (Objects.nonNull(id) && !id.isEmpty()) {
      contextService.delete(id, this).blockingAwait();
    } else throw new RuntimeException("Redis key cannot be null or empty");
  }
}
