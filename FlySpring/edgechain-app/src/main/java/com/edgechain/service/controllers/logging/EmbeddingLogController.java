package com.edgechain.service.controllers.logging;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.logger.entities.EmbeddingLog;
import com.edgechain.lib.logger.services.EmbeddingLogService;
import java.util.HashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("Service EmbeddingLogController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/logs/embeddings")
public class EmbeddingLogController {

  @Autowired private EmbeddingLogService embeddingLogService;

  @GetMapping("/findAll/{page}/{size}")
  public Page<EmbeddingLog> findAll(@PathVariable int page, @PathVariable int size) {
    return this.embeddingLogService.findAll(PageRequest.of(page, size));
  }

  @GetMapping("/findAll/sorted/{page}/{size}")
  public Page<EmbeddingLog> findAllOrderByCompletedAtDesc(
      @PathVariable int page, @PathVariable int size) {
    return this.embeddingLogService.findAllOrderByCompletedAtDesc(PageRequest.of(page, size));
  }

  @PostMapping("/findByModel/{page}/{size}")
  public Page<EmbeddingLog> findAllByModel(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.embeddingLogService.findAllByModel(mapper.get("model"), PageRequest.of(page, size));
  }

  @PostMapping("/findByModel/sorted/{page}/{size}")
  public Page<EmbeddingLog> findAllByModelOrderByCompletedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.embeddingLogService.findAllByModelOrderByCompletedAtDesc(
        mapper.get("model"), PageRequest.of(page, size));
  }

  @PostMapping("/findByIdentifier/{page}/{size}")
  public Page<EmbeddingLog> findAllByCallIdentifier(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.embeddingLogService.findAllByCallIdentifier(
        mapper.get("identifier"), PageRequest.of(page, size));
  }

  @PostMapping("/findByIdentifier/sorted/{page}/{size}")
  public Page<EmbeddingLog> findAllByCallIdentifierOrderByCompletedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.embeddingLogService.findAllByCallIdentifierOrderByCompletedAtDesc(
        mapper.get("identifier"), PageRequest.of(page, size));
  }

  @PostMapping("/findByLatencyLessThanEq/{page}/{size}")
  public Page<EmbeddingLog> findAllByLatencyLessThanEqual(
      @RequestBody HashMap<String, Long> mapper, @PathVariable int page, @PathVariable int size) {
    return this.embeddingLogService.findAllByLatencyLessThanEqual(
        mapper.get("latency"), PageRequest.of(page, size));
  }

  @PostMapping("/findByLatencyGtrThanEq/{page}/{size}")
  public Page<EmbeddingLog> findAllByLatencyGreaterThanEqual(
      @RequestBody HashMap<String, Long> mapper, @PathVariable int page, @PathVariable int size) {
    return this.embeddingLogService.findAllByLatencyGreaterThanEqual(
        mapper.get("latency"), PageRequest.of(page, size));
  }
}
