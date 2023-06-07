package com.edgechain.service.controllers.index;

import com.edgechain.lib.index.providers.redis.RedisQueryProvider;
import com.edgechain.lib.index.providers.redis.RedisUpsertProvider;
import com.edgechain.lib.request.RedisRequest;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

@RestController("Service RedisController")
@RequestMapping("/v1/index/redis")
public class RedisController {

  @PostMapping("/upsert")
  public Mono<ChainResponse> upsert(@RequestBody RedisRequest request) {
    ChainProvider redisUpsert = new RedisUpsertProvider();

    ChainWrapper wrapper = new ChainWrapper();
    return RxJava3Adapter.singleToMono(
        wrapper.chains(new ChainRequest(request.getInput()), redisUpsert).toSingleWithRetry());
  }

  @PostMapping("/query")
  public Mono<ChainResponse> query(@RequestBody RedisRequest request) {
    ChainProvider redisQuery = new RedisQueryProvider(request.getTopK());

    ChainWrapper wrapper = new ChainWrapper();
    return RxJava3Adapter.singleToMono(
        wrapper.chains(new ChainRequest(request.getInput()), redisQuery).toSingleWithRetry());
  }
}
