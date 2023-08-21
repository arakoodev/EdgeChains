package com.edgechain.service.controllers.logging;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.logger.entities.ChatCompletionLog;
import com.edgechain.lib.logger.services.ChatCompletionLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;

@RestController("Service ChatCompletionLogController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/logs/chat-completion")
public class ChatCompletionLogController {

  @Autowired private ChatCompletionLogService chatCompletionLogService;

  @GetMapping("/findAll/{page}/{size}")
  public Page<ChatCompletionLog> findAll(@PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAll(PageRequest.of(page, size));
  }

  @GetMapping("/findAll/sorted/{page}/{size}")
  public Page<ChatCompletionLog> findAllOrderByCompletedAtDesc(
      @PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAllOrderByCompletedAtDesc(PageRequest.of(page, size));
  }

  @PostMapping("/findByName/{page}/{size}")
  public Page<ChatCompletionLog> findAllByName(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAllByName(
        mapper.get("name"), PageRequest.of(page, size));
  }

  @PostMapping("/findByName/sorted/{page}/{size}")
  public Page<ChatCompletionLog> findAllByNameOrderByCompletedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAllByNameOrderByCompletedAtDesc(
        mapper.get("name"), PageRequest.of(page, size));
  }

  @PostMapping("/findByModel/{page}/{size}")
  public Page<ChatCompletionLog> findAllByModel(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAllByModel(
        mapper.get("model"), PageRequest.of(page, size));
  }

  @PostMapping("/findByModel/sorted/{page}/{size}")
  public Page<ChatCompletionLog> findAllByModelOrderByCompletedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAllByModelOrderByCompletedAtDesc(
        mapper.get("model"), PageRequest.of(page, size));
  }

  @PostMapping("/findByIdentifier/{page}/{size}")
  public Page<ChatCompletionLog> findAllByCallIdentifier(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAllByCallIdentifier(
        mapper.get("identifier"), PageRequest.of(page, size));
  }

  @PostMapping("/findByIdentifier/sorted/{page}/{size}")
  public Page<ChatCompletionLog> findAllByCallIdentifierOrderByCompletedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAllByCallIdentifierOrderByCompletedAtDesc(
        mapper.get("identifier"), PageRequest.of(page, size));
  }

  @PostMapping("/findByLatencyLessThanEq/{page}/{size}")
  public Page<ChatCompletionLog> findAllByLatencyLessThanEqual(
      @RequestBody HashMap<String, Long> mapper, @PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAllByLatencyLessThanEqual(
        mapper.get("latency"), PageRequest.of(page, size));
  }

  @PostMapping("/findByLatencyGtrThanEq/{page}/{size}")
  public Page<ChatCompletionLog> findAllByLatencyGreaterThanEqual(
      @RequestBody HashMap<String, Long> mapper, @PathVariable int page, @PathVariable int size) {
    return this.chatCompletionLogService.findAllByLatencyGreaterThanEqual(
        mapper.get("latency"), PageRequest.of(page, size));
  }
}
