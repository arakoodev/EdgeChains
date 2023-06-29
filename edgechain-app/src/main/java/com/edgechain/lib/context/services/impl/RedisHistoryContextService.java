package com.edgechain.lib.context.services.impl;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.domain.HistoryContextRequest;
import com.edgechain.lib.context.domain.HistoryContextResponse;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Repository
public class RedisHistoryContextService implements HistoryContextService {

  private static final String PREFIX = "historycontext-";

  @Autowired private RedisTemplate redisTemplate;

  @Value("${spring.redis.ttl}")
  private long ttl;

  @Override
  public EdgeChain<HistoryContextResponse> create() {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                String key = PREFIX + UUID.randomUUID();

                HistoryContext context = new HistoryContext();
                context.setResponse("");

                this.redisTemplate.opsForValue().set(key, context);
                this.redisTemplate.expire(key, ttl, TimeUnit.SECONDS);

                HistoryContextResponse response = new HistoryContextResponse();
                response.setId(key);
                response.setMessage(
                    "Session is created. Now you can start conversational question and answer");

                emitter.onNext(response);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  @Override
  public EdgeChain<HistoryContext> put(String key, String response) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                HistoryContext historyContext = this.get(key).toSingleWithRetry().blockingGet();
                historyContext.setResponse(response);

                this.redisTemplate.opsForValue().set(key, historyContext);
                this.redisTemplate.expire(key, ttl, TimeUnit.SECONDS);

                System.out.println("Updated");

                emitter.onNext(historyContext);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  @Override
  public EdgeChain<HistoryContext> get(String key) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                Boolean b = this.redisTemplate.hasKey(key);
                if (Boolean.TRUE.equals(b)) {
                  emitter.onNext(
                      Objects.requireNonNull(
                          (HistoryContext) this.redisTemplate.opsForValue().get(key)));
                  emitter.onComplete();
                } else {
                  throw new RuntimeException("Redis HistoryContext key isn't found ==> Either you have incorrectly defined contextId or create it via /v1/history-context/create & use the historyContextId");
                }

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  @Override
  public EdgeChain<ChainResponse> delete(String key) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                this.get(key).toSingleWithRetry().blockingGet();
                this.redisTemplate.delete(key);

                emitter.onNext(new ChainResponse("Session completed ~ " + key));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }
}
