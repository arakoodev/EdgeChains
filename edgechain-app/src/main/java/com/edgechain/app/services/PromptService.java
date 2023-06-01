package com.edgechain.app.services;

import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "promptService", url = "${feign.url}/prompt")
@Component
public interface PromptService extends ToolService {

  @GetMapping("/wiki-summary")
  ChainResponse getWikiSummaryPrompt();

  @GetMapping("/index-query")
  ChainResponse getIndexQueryPrompt();
}
