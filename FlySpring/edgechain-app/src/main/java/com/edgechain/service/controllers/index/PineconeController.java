package com.edgechain.service.controllers.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
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
  public Single<StringResponse> upsert(@RequestBody PineconeEndpoint pineconeEndpoint) {
    EdgeChain<StringResponse> edgeChain =
        new PineconeClient(pineconeEndpoint, pineconeEndpoint.getNamespace())
            .upsert(pineconeEndpoint.getWordEmbeddings());
    return edgeChain.toSingle();
  }

  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody PineconeEndpoint pineconeEndpoint) {
    EdgeChain<List<WordEmbeddings>> edgeChain =
        new PineconeClient(pineconeEndpoint, pineconeEndpoint.getNamespace())
            .query(pineconeEndpoint.getWordEmbeddings(), pineconeEndpoint.getTopK());
    return edgeChain.toSingle();
  }

  @DeleteMapping("/deleteAll")
  public Single<StringResponse> deleteAll(@RequestBody PineconeEndpoint pineconeEndpoint) {
    EdgeChain<StringResponse> edgeChain =
        new PineconeClient(pineconeEndpoint, pineconeEndpoint.getNamespace()).deleteAll();
    return edgeChain.toSingle();
  }
}
