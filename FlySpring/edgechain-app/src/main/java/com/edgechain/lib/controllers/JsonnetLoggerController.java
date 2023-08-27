package com.edgechain.lib.controllers;

import com.edgechain.lib.logger.JsonnetLogger;
import java.util.HashMap;
import java.util.Objects;

import com.edgechain.lib.logger.entities.JsonnetLog;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/logs/jsonnet")
public class JsonnetLoggerController {

  private JsonnetLogger jsonnetLogger;

  private JsonnetLogger getInstance() {
    if (Objects.isNull(jsonnetLogger)) return jsonnetLogger = new JsonnetLogger();
    else return jsonnetLogger;
  }

  @GetMapping("/findAll/{page}/{size}")
  public Page<JsonnetLog> findAll(@PathVariable int page, @PathVariable int size) {
    return getInstance().findAll(page, size);
  }

  @GetMapping("/findAll/sorted/{page}/{size}")
  public Page<JsonnetLog> findAllOrderByCompletedAtDesc(
      @PathVariable int page, @PathVariable int size) {
    return getInstance().findAllOrderByCreatedAtDesc(page, size);
  }

  @PostMapping("/findByName/{page}/{size}")
  public Page<JsonnetLog> findAllBySelectedFileOrderByCreatedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return getInstance()
        .findAllBySelectedFileOrderByCreatedAtDesc(mapper.get("filename"), page, size);
  }
}
