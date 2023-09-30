package com.edgechain.lib.controllers;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.impl.context.RedisHistoryContextEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import org.json.JSONObject;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController("App RedisHistoryContextController")
@RequestMapping("/v1/redis/historycontext")
public class RedisHistoryContextController {
  private RedisHistoryContextEndpoint endpoint;

  private RedisHistoryContextEndpoint getInstance() {
    if (Objects.isNull(endpoint))
      return endpoint = new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));
    else return endpoint;
  }

  @PostMapping
  public HistoryContext create(
      @RequestParam(value = "id", defaultValue = "initialValue") String id) {
    if (id.equals("initialValue"))
      return getInstance().create(UUID.randomUUID().toString()); // Here randomId is generated.
    else return getInstance().create(id);
  }

  @PutMapping
  public HistoryContext put(ArkRequest arkRequest) throws IOException {
    JSONObject json = arkRequest.getBody();
    return getInstance().put(json.getString("id"), json.getString("response"));
  }

  @GetMapping
  public HistoryContext get(ArkRequest arkRequest) {
    String id = arkRequest.getQueryParam("id");
    return getInstance().get(id);
  }

  @DeleteMapping
  public void deleteRedisHistoryContext(ArkRequest arkRequest) {
    String id = arkRequest.getQueryParam("id");
    getInstance().delete(id);
  }
}
