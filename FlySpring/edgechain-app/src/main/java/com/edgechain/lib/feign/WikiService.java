package com.edgechain.lib.feign;

import com.edgechain.lib.wiki.request.WikiRequest;
import com.edgechain.lib.wiki.response.WikiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "wikiService", url = "${feign.host}:${server.port}/v2/wiki")
@Component
public interface WikiService  {

  @PostMapping(
      value = "/page-content",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.APPLICATION_JSON_VALUE})
  WikiResponse getPageContent(@RequestBody WikiRequest request);
}
