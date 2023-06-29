package com.edgechain.service.controllers.index;

import com.edgechain.lib.constants.WebConstants;
import com.edgechain.lib.index.providers.pinecone.PineconeQueryProvider;
import com.edgechain.lib.index.providers.pinecone.PineconeUpsertProvider;
import com.edgechain.lib.index.services.impl.PineconeIndexChain;
import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.*;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

@RestController("Service PineconeController")
@RequestMapping(value = WebConstants.SERVICE_CONTEXT_PATH + "/index/pinecone")
public class PineconeController {

  @PostMapping("/upsert")
  public Single<ChainResponse> upsert(@RequestBody PineconeRequest request) {
    ChainProvider pineconeUpsert = new PineconeUpsertProvider(request.getEndpoint());

    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(request.getInput()), pineconeUpsert).toSingleWithRetry();
  }

  @PostMapping("/query")
  public Single<ChainResponse> query(@RequestBody PineconeRequest request) {
    ChainProvider pineconeQuery =
        new PineconeQueryProvider(request.getEndpoint(), request.getTopK());

    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(request.getInput()), pineconeQuery).toSingleWithRetry();
  }

  @DeleteMapping("/delete")
  public Single<ChainResponse> deleteByKey(@RequestBody PineconeRequest request) {
    return new PineconeIndexChain(request.getEndpoint())
        .deleteByIds(request.getVectorIds())
        .toSingleWithRetry();
  }

  @DeleteMapping("/deleteAll")
  public Single<ChainResponse> deleteAll(@RequestBody PineconeRequest request) {
    return new PineconeIndexChain(request.getEndpoint()).deleteAll().toSingleWithRetry();
  }
}
