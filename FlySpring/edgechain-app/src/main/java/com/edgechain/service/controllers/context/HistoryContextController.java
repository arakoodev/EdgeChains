package com.edgechain.service.controllers.context;

import com.edgechain.lib.context.client.impl.RedisHistoryContextClient;
import com.edgechain.lib.context.domain.ContextPutRequest;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.endpoint.impl.RedisHistoryContextEndpoint;
import com.edgechain.lib.utils.RetryUtils;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;

@RestController
@RequestMapping(value = "/v2/context")
public class HistoryContextController {

  @Autowired private RedisHistoryContextClient contextClient;

  @PostMapping("/create")
  public Single<HistoryContext> create(
      @RequestParam("id") String id, @RequestBody Endpoint endpoint) {

    if (RetryUtils.available(endpoint))
      return this.contextClient.create(id).toSingle(endpoint.getRetryPolicy());
    else return this.contextClient.create(id).toSingle();
  }

  @PostMapping("/update")
  public Single<HistoryContext> put(@RequestBody ContextPutRequest request) {

    if (RetryUtils.available(request.getEndpoint()))
      return contextClient.put(request.getId(), request.getResponse()).toSingle(request.getEndpoint().getRetryPolicy());
    else return contextClient.put(request.getId(), request.getResponse()).toSingle();
  }

  @PostMapping(value = "/{id}")
  public Single<HistoryContext> get(@PathVariable("id") String id, @RequestBody Endpoint endpoint) {

    if (RetryUtils.available(endpoint))
      return contextClient.get(id).toSingle(endpoint.getRetryPolicy());
    else return contextClient.get(id).toSingle();
  }

  @PostMapping(value = "/check/{id}")
  public Single<Boolean> check(@PathVariable("id") String id, @RequestBody Endpoint endpoint) {

    if (RetryUtils.available(endpoint))
      return contextClient.check(id).toSingle(endpoint.getRetryPolicy());
    else return contextClient.check(id).toSingle();
  }

  @DeleteMapping("/{id}")
  public Completable delete(@PathVariable("id") String id, @RequestBody Endpoint endpoint) {

    if (RetryUtils.available(endpoint))
      return contextClient.delete(id).await(endpoint.getRetryPolicy());

    else
      return contextClient.delete(id).await();

  }
}
