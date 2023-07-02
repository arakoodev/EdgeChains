package com.edgechain.lib.feign;

import com.edgechain.lib.context.domain.HistoryContext;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;

@FeignClient(name = "redisContextService",url = "${feign.host}:${server.port}/v2/context" )
@Component
public interface RedisContextService {

    @PostMapping(value = "/create", consumes = {MediaType.APPLICATION_JSON_VALUE}, produces = {MediaType.APPLICATION_JSON_VALUE})
    HistoryContext create();

    @PostMapping(value = "/update", consumes = {MediaType.APPLICATION_JSON_VALUE}, produces = {MediaType.APPLICATION_JSON_VALUE})
    HistoryContext update(@RequestBody HashMap<String, String> mapper);

    @GetMapping(value = "/{key}", consumes = {MediaType.APPLICATION_JSON_VALUE}, produces = {MediaType.APPLICATION_JSON_VALUE})
    HistoryContext get(@PathVariable("key") String key);

    @GetMapping(value = "/check/{key}", consumes = {MediaType.APPLICATION_JSON_VALUE}, produces = {MediaType.APPLICATION_JSON_VALUE})
    Boolean check(@PathVariable("key") String key);

    @DeleteMapping(value = "/{id}", consumes = {MediaType.APPLICATION_JSON_VALUE}, produces = {MediaType.APPLICATION_JSON_VALUE})
    void delete(@PathVariable("id") String id);


}
