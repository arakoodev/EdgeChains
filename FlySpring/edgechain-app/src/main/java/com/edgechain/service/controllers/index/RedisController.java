package com.edgechain.service.controllers.index;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.index.RedisEndpoint;
import com.edgechain.lib.index.client.impl.RedisClient;
import com.edgechain.lib.response.StringResponse;
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

  @PostMapping("/create-index")
  public Single<StringResponse> createIndex(@RequestBody RedisEndpoint redisEndpoint) {
    return this.redisClient.createIndex(redisEndpoint).toSingle();
  }

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody RedisEndpoint redisEndpoint) {
    return this.redisClient.upsert(redisEndpoint).toSingle();
  }

  @PostMapping("/batch-upsert")
  public Single<StringResponse> batchUpsert(@RequestBody RedisEndpoint redisEndpoint) {
    return this.redisClient.batchUpsert(redisEndpoint).toSingleWithoutScheduler();
  }

  @PostMapping("/query")
  public Single<List<WordEmbeddings>> query(@RequestBody RedisEndpoint redisEndpoint) {
    return this.redisClient.query(redisEndpoint).toSingle();
  }

  @DeleteMapping("/delete")
  public Completable deleteByPattern(@RequestBody RedisEndpoint redisEndpoint) {
    return this.redisClient.deleteByPattern(redisEndpoint).await();
  }
}
