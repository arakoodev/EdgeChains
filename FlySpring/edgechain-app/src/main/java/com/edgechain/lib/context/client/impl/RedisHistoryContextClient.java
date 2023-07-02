package com.edgechain.lib.context.client.impl;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.client.HistoryContextClient;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Repository
public class RedisHistoryContextClient implements HistoryContextClient {

  private Logger logger = LoggerFactory.getLogger(this.getClass());

  private static final String PREFIX = "historycontext-";

  @Autowired private RedisTemplate redisTemplate;

  @Value("${spring.redis.ttl}")
  private long ttl;

  @Override
  public EdgeChain<HistoryContext> create() {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                String key = PREFIX + UUID.randomUUID();

                HistoryContext context = new HistoryContext();
                context.setId(key);
                context.setResponse("");

                this.redisTemplate.opsForValue().set(key, context);
                this.redisTemplate.expire(key, ttl, TimeUnit.SECONDS);

                emitter.onNext(context);
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

                logger.info(String.format("%s is updated", key));

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
                    emitter.onError(new RuntimeException(
                        "Redis HistoryContextController key isn't found ==> Either you have incorrectly defined"
                            + " contextId or create it via /v1/history-context/create & use the"
                            + " historyContextId"));
                }

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

    @Override
    public EdgeChain<Boolean> check(String key) {
    return new EdgeChain<>(
            Observable.create(emitter -> {
                try{
                    Boolean b = this.redisTemplate.hasKey(key);
                    emitter.onNext(Objects.requireNonNull(b));
                    emitter.onComplete();
                }catch (final Exception e){
                    emitter.onError(e);
                }
            })
    );
    }

    @Override
  public Completable delete(String key) {

    return Completable.create(emitter -> {
        try {
            this.get(key).toSingleWithRetry().blockingGet();
            this.redisTemplate.delete(key);
            emitter.onComplete();

        } catch (final Exception e) {
            emitter.onError(e);
        }
    });
  }
}
