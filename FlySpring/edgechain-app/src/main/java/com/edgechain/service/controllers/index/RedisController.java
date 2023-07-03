package com.edgechain.service.controllers.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.index.request.feign.RedisRequest;
import com.edgechain.lib.index.client.impl.RedisClient;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;

@RestController("Service RedisController")
@RequestMapping(value =  "/v2/index/redis")
public class RedisController {

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody RedisRequest request) {
    return new RedisClient(request.getEndpoint(),request.getIndexName(),request.getNamespace())
            .upsert(request.getWordEmbeddings(),request.getDimensions(),request.getMetric())
            .toSingleWithRetry();
  }

  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody RedisRequest request) {
    return new RedisClient(request.getEndpoint(), request.getIndexName(), request.getNamespace())
            .query(request.getWordEmbeddings(), request.getTopK())
            .toSingleWithRetry();
  }

  @DeleteMapping("/delete")
  public Completable deleteByPattern(@RequestBody HashMap<String,String> mapper) {

    return new RedisClient().deleteByPattern(mapper.get("pattern")).getScheduledObservableWithRetry()
            .firstOrError().ignoreElement();
  }

}
