package com.edgechain.service.controllers.index;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("Service RedisController")
@RequestMapping(value =  "/v2/index/redis")
public class RedisController {

//  @PostMapping("/upsert")
//  public Single<ChainResponse> upsert(@RequestBody RedisRequest request) {
//    ChainProvider redisUpsert = new RedisUpsertProvider();
//
//    ChainWrapper wrapper = new ChainWrapper();
//    return wrapper.chains(new ChainRequest(request.getInput()), redisUpsert).toSingleWithRetry();
//  }
//
//  @PostMapping("/query")
//  public Single<ChainResponse> query(@RequestBody RedisRequest request) {
//    ChainProvider redisQuery = new RedisQueryProvider(request.getTopK());
//
//    ChainWrapper wrapper = new ChainWrapper();
//    return wrapper.chains(new ChainRequest(request.getInput()), redisQuery).toSingleWithRetry();
//  }
}
