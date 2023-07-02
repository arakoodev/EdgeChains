package com.edgechain.service.controllers.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.index.request.feign.PineconeRequest;
import com.edgechain.lib.index.services.impl.PineconeIndexChain;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController("Service PineconeController")
@RequestMapping(value = "/v2/index/pinecone")
public class PineconeController {

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody PineconeRequest request) {
   return new PineconeIndexChain(request.getEndpoint(),request.getNamespace())
            .upsert(request.getWordEmbeddings())
           .toSingleWithRetry();
  }
//
  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody PineconeRequest request) {
    return new PineconeIndexChain(request.getEndpoint(), request.getNamespace())
            .query(request.getWordEmbeddings(), request.getTopK())
            .toSingleWithRetry();
  }
//
//  @DeleteMapping("/delete")
//  public Single<StringResponse> deleteByKey(@RequestBody PineconeRequest request) {
//    return new PineconeIndexChain(request.getEndpoint())
//        .deleteByIds(request.getVectorIds(), request.getNamespace())
//        .toSingleWithRetry();
//  }
//
  @DeleteMapping("/deleteAll")
  public Single<StringResponse> deleteAll(@RequestBody PineconeRequest request) {
    return new PineconeIndexChain(request.getEndpoint(), request.getNamespace()).deleteAll().toSingleWithRetry();
  }
}
