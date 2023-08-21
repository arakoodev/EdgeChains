package com.edgechain.lib.controllers;

import com.edgechain.lib.logger.ChatCompletionLogger;
import com.edgechain.lib.logger.entities.ChatCompletionLog;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Objects;

@RestController
@RequestMapping("/v1/logs/chat")
public class ChatCompletionLoggerController {

  private ChatCompletionLogger chatCompletionLogger;

  private ChatCompletionLogger getInstance() {
    if (Objects.isNull(chatCompletionLogger))
      return chatCompletionLogger = new ChatCompletionLogger();
    else return chatCompletionLogger;
  }

  @GetMapping("/findAll/{page}/{size}")
  public Page<ChatCompletionLog> findAll(@PathVariable int page, @PathVariable int size) {
    return getInstance().findAll(page, size);
  }

  @GetMapping("/findAll/sorted/{page}/{size}")
  public Page<ChatCompletionLog> findAllOrderByCompletedAtDesc(
      @PathVariable int page, @PathVariable int size) {
    return getInstance().findAllOrderByCompletedAtDesc(page, size);
  }

  @PostMapping("/findByName/{page}/{size}")
  public Page<ChatCompletionLog> findAllByName(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return getInstance().findAllByName(mapper.get("name"), page, size);
  }

  @PostMapping("/findByName/sorted/{page}/{size}")
  public Page<ChatCompletionLog> findAllByNameOrderByCompletedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return getInstance().findAllByNameOrderByCompletedAtDesc(mapper.get("name"), page, size);
  }

  @PostMapping("/findByModel/{page}/{size}")
  public Page<ChatCompletionLog> findAllByModel(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return getInstance().findAllByModel(mapper.get("model"), page, size);
  }

  @PostMapping("/findByModel/sorted/{page}/{size}")
  public Page<ChatCompletionLog> findAllByModelOrderByCompletedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return getInstance().findAllByModelOrderByCompletedAtDesc(mapper.get("model"), page, size);
  }

  @PostMapping("/findByIdentifier/{page}/{size}")
  public Page<ChatCompletionLog> findAllByCallIdentifier(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return getInstance().findAllByCallIdentifier(mapper.get("identifier"), page, size);
  }

  @PostMapping("/findByIdentifier/sorted/{page}/{size}")
  public Page<ChatCompletionLog> findAllByCallIdentifierOrderByCompletedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return getInstance()
        .findAllByCallIdentifierOrderByCompletedAtDesc(mapper.get("identifier"), page, size);
  }

  @PostMapping("/findByLatencyLessThanEq/{page}/{size}")
  public Page<ChatCompletionLog> findAllByLatencyLessThanEqual(
      @RequestBody HashMap<String, Long> mapper, @PathVariable int page, @PathVariable int size) {
    return getInstance().findAllByLatencyLessThanEqual(mapper.get("latency"), page, size);
  }

  @PostMapping("/findByLatencyGtrThanEq/{page}/{size}")
  public Page<ChatCompletionLog> findAllByLatencyGreaterThanEqual(
      @RequestBody HashMap<String, Long> mapper, @PathVariable int page, @PathVariable int size) {
    return getInstance().findAllByLatencyGreaterThanEqual(mapper.get("latency"), page, size);
  }
}
