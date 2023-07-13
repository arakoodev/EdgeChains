package com.edgechain.service.controllers.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.index.client.impl.RedisClient;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController("Service RedisController")
@RequestMapping(value = "/v2/index/redis")
public class RedisController {

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody RedisEndpoint redisEndpoint) {

    EdgeChain<StringResponse> edgeChain =
        new RedisClient(redisEndpoint, redisEndpoint.getIndexName(), redisEndpoint.getNamespace())
            .upsert(
                redisEndpoint.getWordEmbeddings(),
                redisEndpoint.getDimensions(),
                redisEndpoint.getMetric());

    return edgeChain.toSingle();
  }

  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody RedisEndpoint redisEndpoint) {

    EdgeChain<List<WordEmbeddings>> edgeChain =
        new RedisClient(redisEndpoint, redisEndpoint.getIndexName(), redisEndpoint.getNamespace())
            .query(redisEndpoint.getWordEmbeddings(), redisEndpoint.getTopK());

    return edgeChain.toSingle();
  }

  @DeleteMapping("/delete")
  public Completable deleteByPattern(
      @RequestParam("pattern") String pattern, @RequestBody RedisEndpoint redisEndpoint) {
    EdgeChain<String> edgeChain = new RedisClient(redisEndpoint).deleteByPattern(pattern);
    return edgeChain.await();
  }
}
