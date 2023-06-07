package com.edgechain.service.controllers.index;

import com.edgechain.lib.index.providers.pinecone.PineconeQueryProvider;
import com.edgechain.lib.index.providers.pinecone.PineconeUpsertProvider;
import com.edgechain.lib.index.services.impl.PineconeIndexChain;
import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import org.springframework.web.bind.annotation.*;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

@RestController("Service PineconeController")
@RequestMapping("/v1/index/pinecone")
public class PineconeController {

  @PostMapping("/upsert")
  public Mono<ChainResponse> upsert(@RequestBody PineconeRequest request) {
    ChainProvider pineconeUpsert = new PineconeUpsertProvider(request.getEndpoint());

    ChainWrapper wrapper = new ChainWrapper();
    return RxJava3Adapter.singleToMono(
        wrapper.chains(new ChainRequest(request.getInput()), pineconeUpsert).toSingleWithRetry());
  }

  @PostMapping("/query")
  public Mono<ChainResponse> query(@RequestBody PineconeRequest request) {
    ChainProvider pineconeQuery =
        new PineconeQueryProvider(request.getEndpoint(), request.getTopK());

    ChainWrapper wrapper = new ChainWrapper();
    return RxJava3Adapter.singleToMono(
        wrapper.chains(new ChainRequest(request.getInput()), pineconeQuery).toSingleWithRetry());
  }

  @DeleteMapping("/delete")
  public Mono<ChainResponse> deleteByKey(@RequestBody PineconeRequest request) {
    return RxJava3Adapter.singleToMono(
        new PineconeIndexChain(request.getEndpoint())
            .deleteByIds(request.getVectorIds())
            .toSingleWithRetry());
  }

  @DeleteMapping("/deleteAll")
  public Mono<ChainResponse> deleteAll(@RequestBody PineconeRequest request) {
    return RxJava3Adapter.singleToMono(
        new PineconeIndexChain(request.getEndpoint()).deleteAll().toSingleWithRetry());
  }
}
