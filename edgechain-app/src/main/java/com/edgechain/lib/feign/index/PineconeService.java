package com.edgechain.lib.feign.index;

import com.edgechain.lib.feign.index.IndexService;
import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "pineconeService", url = "${server.url}/index/pinecone")
@Component
public interface PineconeService extends IndexService<PineconeRequest> {
  @Override
  @PostMapping(
      value = "/upsert",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse upsert(@RequestBody PineconeRequest request);

  @Override
  @PostMapping(
      value = "/query",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse query(@RequestBody PineconeRequest request);

  @Override
  @DeleteMapping(
      value = "/delete",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse deleteByKeys(PineconeRequest request);

  @Override
  @DeleteMapping(
      value = "/deleteAll",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  ChainResponse deleteAll(@RequestBody PineconeRequest request);
}
