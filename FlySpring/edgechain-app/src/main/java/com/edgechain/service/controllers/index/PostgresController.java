package com.edgechain.service.controllers.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.client.impl.PostgresClient;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Single;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController("Service PostgresController")
@RequestMapping(value = "/v2/index/postgres")
public class PostgresController {

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody PostgresEndpoint postgresEndpoint) {
    EdgeChain<StringResponse> edgeChain =
        new PostgresClient(postgresEndpoint).upsert(postgresEndpoint.getWordEmbeddings());
    return edgeChain.toSingle();
  }

  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody PostgresEndpoint postgresEndpoint) {
    EdgeChain<List<WordEmbeddings>> edgeChain =
        new PostgresClient(postgresEndpoint)
            .query(
                postgresEndpoint.getWordEmbeddings(),
                postgresEndpoint.getMetric(),
                postgresEndpoint.getTopK());
    return edgeChain.toSingle();
  }

  @DeleteMapping("/deleteAll")
  public Single<StringResponse> deleteAll(@RequestBody PostgresEndpoint postgresEndpoint) {
    EdgeChain<StringResponse> edgeChain = new PostgresClient(postgresEndpoint).deleteAll();
    return edgeChain.toSingle();
  }
}
