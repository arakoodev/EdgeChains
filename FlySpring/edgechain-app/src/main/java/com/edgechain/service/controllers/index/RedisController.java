package com.edgechain.service.controllers.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.index.request.feign.RedisRequest;
import com.edgechain.lib.index.client.impl.RedisClient;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.utils.RetryUtils;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;

@RestController("Service RedisController")
@RequestMapping(value = "/v2/index/redis")
public class RedisController {

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody RedisRequest request) {

    EdgeChain<StringResponse> edgeChain =
        new RedisClient(request.getEndpoint(), request.getIndexName(), request.getNamespace())
            .upsert(request.getWordEmbeddings(), request.getDimensions(), request.getMetric());

    if (RetryUtils.available(request.getEndpoint()))
      return edgeChain.toSingle(request.getEndpoint().getRetryPolicy());
    else return edgeChain.toSingle();
  }

  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody RedisRequest request) {

    EdgeChain<List<WordEmbeddings>> edgeChain =
        new RedisClient(request.getEndpoint(), request.getIndexName(), request.getNamespace())
            .query(request.getWordEmbeddings(), request.getTopK());

    if (RetryUtils.available(request.getEndpoint()))
      return edgeChain.toSingle(request.getEndpoint().getRetryPolicy());
    else return edgeChain.toSingle();
  }

  @DeleteMapping("/delete")
  public Completable deleteByPattern(@RequestParam("pattern") String pattern, @RequestBody Endpoint endpoint) {

    EdgeChain<String> edgeChain = new RedisClient().deleteByPattern(pattern);

    if (RetryUtils.available(endpoint))
      return edgeChain
          .getScheduledObservable(endpoint.getRetryPolicy())
          .firstOrError()
          .ignoreElement();
    else return edgeChain.getScheduledObservable().firstOrError().ignoreElement();
  }
}
