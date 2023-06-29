package com.edgechain.service.controllers.index;

import com.edgechain.lib.constants.WebConstants;
import com.edgechain.lib.index.providers.redis.RedisQueryProvider;
import com.edgechain.lib.index.providers.redis.RedisUpsertProvider;
import com.edgechain.lib.request.RedisRequest;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

@RestController("Service RedisController")
@RequestMapping(value =  WebConstants.SERVICE_CONTEXT_PATH + "/index/redis")
public class RedisController {

  @PostMapping("/upsert")
  public Single<ChainResponse> upsert(@RequestBody RedisRequest request) {
    ChainProvider redisUpsert = new RedisUpsertProvider();

    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(request.getInput()), redisUpsert).toSingleWithRetry();
  }

  @PostMapping("/query")
  public Single<ChainResponse> query(@RequestBody RedisRequest request) {
    ChainProvider redisQuery = new RedisQueryProvider(request.getTopK());

    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(request.getInput()), redisQuery).toSingleWithRetry();
  }
}
