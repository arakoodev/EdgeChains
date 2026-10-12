package com.edgechain.service.controllers.logging;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.logger.entities.JsonnetLog;
import java.util.HashMap;

import com.edgechain.lib.logger.services.JsonnetLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

@RestController("Service JsonnetLogControllers")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/logs/jsonnet")
public class JsonnetLogController {

  @Autowired private JsonnetLogService jsonnetLogService;

  @GetMapping("/findAll/{page}/{size}")
  public Page<JsonnetLog> findAll(@PathVariable int page, @PathVariable int size) {
    return this.jsonnetLogService.findAll(PageRequest.of(page, size));
  }

  @GetMapping("/findAll/sorted/{page}/{size}")
  public Page<JsonnetLog> findAllByOrderByCreatedAtDesc(
      @PathVariable int page, @PathVariable int size) {
    return this.jsonnetLogService.findAllOrderByCreatedAtDesc(PageRequest.of(page, size));
  }

  @PostMapping("/findByName/sorted/{page}/{size}")
  public Page<JsonnetLog> findAllBySelectedFileOrderByCreatedAtDesc(
      @RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
    return this.jsonnetLogService.findAllBySelectedFileOrderByCreatedAtDesc(
        mapper.get("filename"), PageRequest.of(page, size));
  }
}
