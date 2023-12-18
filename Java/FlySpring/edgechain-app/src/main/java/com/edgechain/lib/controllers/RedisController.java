package com.edgechain.lib.controllers;

import com.edgechain.lib.endpoint.impl.index.RedisEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

@RestController("App RedisController")
@RequestMapping("/v1/redis")
public class RedisController {

  private RedisEndpoint redisEndpoint;

  private RedisEndpoint getInstance() {
    if (Objects.isNull(redisEndpoint)) {
      return redisEndpoint = new RedisEndpoint(new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));
    } else return redisEndpoint;
  }

  /** Delete Redis By Pattern Name * */
  @DeleteMapping("/delete")
  // delete all the
  // keys start with machine-learning namespace
  public void deleteRedis(ArkRequest arkRequest) {
    String patternName = arkRequest.getQueryParam("pattern");
    getInstance().delete(patternName);
  }
}
