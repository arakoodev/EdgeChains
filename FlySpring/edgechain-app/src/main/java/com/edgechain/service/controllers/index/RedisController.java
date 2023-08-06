package com.edgechain.service.controllers.index;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.index.client.impl.RedisClient;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController("Service RedisController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/index/redis")
public class RedisController {

  @Autowired @Lazy private RedisClient redisClient;

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody RedisEndpoint redisEndpoint) {

    this.redisClient.setEndpoint(redisEndpoint);

    EdgeChain<StringResponse> edgeChain =
        this.redisClient.upsert(
            redisEndpoint.getWordEmbeddings(),
            redisEndpoint.getDimensions(),
            redisEndpoint.getMetric());

    return edgeChain.toSingle();
  }

  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody RedisEndpoint redisEndpoint) {

    this.redisClient.setEndpoint(redisEndpoint);

    EdgeChain<List<WordEmbeddings>> edgeChain =
        this.redisClient.query(redisEndpoint.getWordEmbeddings(), redisEndpoint.getTopK());

    return edgeChain.toSingle();
  }

  @DeleteMapping("/delete")
  public Completable deleteByPattern(
      @RequestParam("pattern") String pattern, @RequestBody RedisEndpoint redisEndpoint) {

    this.redisClient.setEndpoint(redisEndpoint);

    EdgeChain<StringResponse> edgeChain = this.redisClient.deleteByPattern(pattern);
    return edgeChain.await();
  }
}
