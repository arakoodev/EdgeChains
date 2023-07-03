package com.edgechain.lib.feign;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.index.request.feign.RedisRequest;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Completable;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import javax.print.attribute.standard.Media;
import java.util.HashMap;
import java.util.List;

@FeignClient(name = "redisService", url = "${feign.host}:${server.port}/v2/index/redis")
@Component
public interface RedisService  {

  @PostMapping(
      value = "/upsert",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  StringResponse upsert(@RequestBody RedisRequest request);

  @PostMapping(
      value = "/query",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  List<WordEmbeddings> query(@RequestBody RedisRequest request);

  @DeleteMapping(value = "/delete", consumes = {MediaType.APPLICATION_JSON_VALUE}, produces = {MediaType.APPLICATION_JSON_VALUE})
  void deleteByPattern(@RequestBody HashMap<String,String> mapper);

}
