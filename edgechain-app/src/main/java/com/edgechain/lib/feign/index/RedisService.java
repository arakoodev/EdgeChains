package com.edgechain.lib.feign.index;

import com.edgechain.lib.feign.index.IndexService;
import com.edgechain.lib.request.RedisRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "redisService", url = "${feign.url}/index/redis")
@Component
public interface RedisService extends IndexService<RedisRequest> {

  @Override
  @PostMapping(
      value = "/upsert",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse upsert(@RequestBody RedisRequest request);

  @Override
  @PostMapping(
      value = "/query",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse query(@RequestBody RedisRequest request);

  @Override
  @PostMapping(
      value = "/delete",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse deleteByKeys(@RequestBody RedisRequest request);

  @Override
  @PostMapping(
      value = "/deleteAll",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse deleteAll(@RequestBody RedisRequest request);
}
