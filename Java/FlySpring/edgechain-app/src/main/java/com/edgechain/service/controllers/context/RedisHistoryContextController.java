package com.edgechain.service.controllers.context;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.context.client.impl.RedisHistoryContextClient;
import com.edgechain.lib.context.domain.ContextPutRequest;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.impl.context.RedisHistoryContextEndpoint;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/context/redis")
public class RedisHistoryContextController {

  @Autowired private RedisHistoryContextClient contextClient;

  @PostMapping("/create")
  public Single<HistoryContext> create(
      @RequestParam("id") String id, @RequestBody RedisHistoryContextEndpoint endpoint) {
    return this.contextClient.create(id, endpoint).toSingle();
  }

  @PostMapping("/update")
  public Single<HistoryContext> put(
      @RequestBody ContextPutRequest<RedisHistoryContextEndpoint> request) {
    return this.contextClient
        .put(request.getId(), request.getResponse(), request.getEndpoint())
        .toSingle();
  }

  @PostMapping(value = "/{id}")
  public Single<HistoryContext> get(
      @PathVariable("id") String id, @RequestBody RedisHistoryContextEndpoint endpoint) {
    return this.contextClient.get(id, endpoint).toSingle();
  }

  @DeleteMapping("/{id}")
  public Completable delete(
      @PathVariable("id") String id, @RequestBody RedisHistoryContextEndpoint endpoint) {
    return this.contextClient.delete(id, endpoint).await();
  }
}
