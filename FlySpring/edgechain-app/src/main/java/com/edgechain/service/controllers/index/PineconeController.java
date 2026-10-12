package com.edgechain.service.controllers.index;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.index.PineconeEndpoint;
import com.edgechain.lib.index.client.impl.PineconeClient;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController("Service PineconeController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/index/pinecone")
public class PineconeController {

  @Autowired private PineconeClient pineconeClient;

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody PineconeEndpoint pineconeEndpoint) {
    return pineconeClient.upsert(pineconeEndpoint).toSingle();
  }

  @PostMapping("/batch-upsert")
  public Single<StringResponse> batchUpsert(@RequestBody PineconeEndpoint pineconeEndpoint) {
    return pineconeClient.batchUpsert(pineconeEndpoint).toSingleWithoutScheduler();
  }

  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody PineconeEndpoint pineconeEndpoint) {
    return pineconeClient.query(pineconeEndpoint).toSingle();
  }

  @DeleteMapping("/deleteAll")
  public Single<StringResponse> deleteAll(@RequestBody PineconeEndpoint pineconeEndpoint) {
    return pineconeClient.deleteAll(pineconeEndpoint).toSingle();
  }
}
