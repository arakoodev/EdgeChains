package com.edgechain.service.controllers.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.index.request.feign.PineconeRequest;
import com.edgechain.lib.index.client.impl.PineconeClient;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController("Service PineconeController")
@RequestMapping(value = "/v2/index/pinecone")
public class PineconeController {

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody PineconeRequest request) {
    EdgeChain<StringResponse> edgeChain =
        new PineconeClient(request.getEndpoint(), request.getNamespace())
            .upsert(request.getWordEmbeddings());
    return edgeChain.toSingle();
  }

  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody PineconeRequest request) {
    EdgeChain<List<WordEmbeddings>> edgeChain =
        new PineconeClient(request.getEndpoint(), request.getNamespace())
            .query(request.getWordEmbeddings(), request.getTopK());
    return edgeChain.toSingle();
  }

  @DeleteMapping("/deleteAll")
  public Single<StringResponse> deleteAll(@RequestBody PineconeRequest request) {
    EdgeChain<StringResponse> edgeChain =
        new PineconeClient(request.getEndpoint(), request.getNamespace()).deleteAll();
    return edgeChain.toSingle();
  }
}
