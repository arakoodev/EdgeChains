package com.edgechain.app.services;

import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "pluginService", url = "${feign.url}/plugins")
@Component
public interface PluginService extends ToolService {

  @GetMapping("/wiki")
  ChainResponse wikiContent(@RequestParam("query") String query);
}
