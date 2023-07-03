package com.edgechain.lib.feign;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.index.request.feign.PineconeRequest;
import com.edgechain.lib.response.StringResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

@FeignClient(name = "pineconeService", url = "${feign.host}:${server.port}/v2/index/pinecone")
@Component
public interface PineconeService  {
  @PostMapping(
      value = "/upsert",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  StringResponse upsert(@RequestBody PineconeRequest request);

  @PostMapping(
      value = "/query",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  List<WordEmbeddings> query(@RequestBody PineconeRequest request);

  @DeleteMapping(
      value = "/deleteAll",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  StringResponse deleteAll(@RequestBody PineconeRequest request);
}
