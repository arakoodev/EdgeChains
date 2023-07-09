package com.edgechain.service.controllers.context;

import com.edgechain.lib.context.client.impl.RedisHistoryContextClient;
import com.edgechain.lib.context.domain.ContextPutRequest;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.Endpoint;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value = "/v2/context")
public class HistoryContextController {

  @Autowired private RedisHistoryContextClient contextClient;

  @PostMapping("/create")
  public Single<HistoryContext> create(
      @RequestParam("id") String id, @RequestBody Endpoint endpoint) {
    return this.contextClient.create(id, endpoint).toSingle();
  }

  @PostMapping("/update")
  public Single<HistoryContext> put(@RequestBody ContextPutRequest request) {
    return this.contextClient
        .put(request.getId(), request.getResponse(), request.getEndpoint())
        .toSingle();
  }

  @PostMapping(value = "/{id}")
  public Single<HistoryContext> get(@PathVariable("id") String id, @RequestBody Endpoint endpoint) {
    return this.contextClient.get(id, endpoint).toSingle();
  }

  @PostMapping(value = "/check/{id}")
  public Single<Boolean> check(@PathVariable("id") String id, @RequestBody Endpoint endpoint) {
    return this.contextClient.check(id, endpoint).toSingle();
  }

  @DeleteMapping("/{id}")
  public Completable delete(@PathVariable("id") String id, @RequestBody Endpoint endpoint) {
    return this.contextClient.delete(id, endpoint).await();
  }
}
