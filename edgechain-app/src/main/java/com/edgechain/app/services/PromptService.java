package com.edgechain.app.services;

import com.edgechain.lib.rxjava.response.ChainResponse;

import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "promptService", url = "${feign.url}/prompt")
@Component
public interface PromptService extends ToolService {

  @GetMapping(value = "/wiki-summary", consumes = { MediaType.APPLICATION_JSON_VALUE }, produces = {
      MediaType.APPLICATION_JSON_VALUE })
  ChainResponse getWikiSummaryPrompt();

  @GetMapping(value = "/rap-query", consumes = { MediaType.APPLICATION_JSON_VALUE }, produces = {
      MediaType.APPLICATION_JSON_VALUE })
  ChainResponse getRapQueryPrompt();

  @GetMapping(value = "/custom-query", consumes = { MediaType.APPLICATION_JSON_VALUE }, produces = {
      MediaType.APPLICATION_JSON_VALUE })
  ChainResponse getCustomQueryPrompt(Map<String, String> extVarSettings);

  @GetMapping(value = "/index-query", consumes = { MediaType.APPLICATION_JSON_VALUE }, produces = {
      MediaType.APPLICATION_JSON_VALUE })
  ChainResponse getIndexQueryPrompt();
}
