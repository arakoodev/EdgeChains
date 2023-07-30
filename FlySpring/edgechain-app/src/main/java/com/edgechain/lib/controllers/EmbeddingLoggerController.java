package com.edgechain.lib.controllers;

import com.edgechain.lib.logger.EmbeddingLogger;
import com.edgechain.lib.logger.EmbeddingLogger;
import com.edgechain.lib.logger.entities.EmbeddingLog;
import java.util.HashMap;
import java.util.Objects;

import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/logs/embeddings")
public class EmbeddingLoggerController {

    private EmbeddingLogger embeddingLogger;

    private EmbeddingLogger getInstance() {
    if (Objects.isNull(embeddingLogger)) return embeddingLogger = new EmbeddingLogger();
    else return embeddingLogger;
    }

    @GetMapping("/findAll/{page}/{size}")
    public Page<EmbeddingLog> findAll(@PathVariable int page, @PathVariable int size) {
        return getInstance().findAll(page,size);
    }

    @GetMapping("/findAll/sorted/{page}/{size}")
    public Page<EmbeddingLog> findAllOrderByCompletedAtDesc(@PathVariable int page, @PathVariable int size) {
        return getInstance().findAllOrderByCompletedAtDesc(page,size);
    }

  
    @PostMapping("/findByModel/{page}/{size}")
    public Page<EmbeddingLog> findAllByModel(@RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
        return getInstance().findAllByModel(mapper.get("model"), page,size);
    }

    @PostMapping("/findByModel/sorted/{page}/{size}")
    public Page<EmbeddingLog> findAllByModelOrderByCompletedAtDesc(@RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
        return getInstance().findAllByModelOrderByCompletedAtDesc(mapper.get("model"), page,size);
    }

    @PostMapping("/findByIdentifier/{page}/{size}")
    public Page<EmbeddingLog> findAllByCallIdentifier(@RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
        return getInstance().findAllByCallIdentifier(mapper.get("identifier"),page,size);
    }

    @PostMapping("/findByIdentifier/sorted/{page}/{size}")
    public Page<EmbeddingLog> findAllByCallIdentifierOrderByCompletedAtDesc(@RequestBody HashMap<String, String> mapper, @PathVariable int page, @PathVariable int size) {
        return getInstance().findAllByCallIdentifierOrderByCompletedAtDesc(mapper.get("identifier"), page,size);
    }

    @PostMapping("/findByLatencyLessThanEq/{page}/{size}")
    public Page<EmbeddingLog> findAllByLatencyLessThanEqual(@RequestBody HashMap<String, Long> mapper, @PathVariable int page, @PathVariable int size) {
        return getInstance().findAllByLatencyLessThanEqual(mapper.get("latency"), page,size);
    }

    @PostMapping("/findByLatencyGtrThanEq/{page}/{size}")
    public Page<EmbeddingLog> findAllByLatencyGreaterThanEqual(@RequestBody HashMap<String, Long> mapper, @PathVariable int page, @PathVariable int size) {
        return getInstance().findAllByLatencyGreaterThanEqual(mapper.get("latency"), page,size);
    }



}
