package com.edgechain.app.controllers.context;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.domain.HistoryContextResponse;
import com.edgechain.lib.context.services.impl.RedisHistoryContextService;
import com.edgechain.lib.context.domain.HistoryContextRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/history-context")
public class RedisHistoryContextController {

  @Autowired private RedisHistoryContextService historyContextService;

  @PostMapping("/create")
  public Mono<HistoryContextResponse> create(@RequestBody HistoryContextRequest contextRequest) {
    return RxJava3Adapter.singleToMono(
        historyContextService.create(contextRequest).toSingleWithRetry());
  }

  @GetMapping("/{id}")
  public Mono<HistoryContext> findById(@PathVariable String id) {
    return RxJava3Adapter.singleToMono(historyContextService.get(id).toSingleWithRetry());
  }

  @DeleteMapping("/{id}")
  public Mono<ChainResponse> delete(@PathVariable String id) {
    return RxJava3Adapter.singleToMono(historyContextService.delete(id).toSingleWithRetry());
  }
}
