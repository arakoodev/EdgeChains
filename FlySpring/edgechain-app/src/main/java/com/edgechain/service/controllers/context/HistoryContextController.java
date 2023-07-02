package com.edgechain.service.controllers.context;

import com.edgechain.lib.context.client.impl.RedisHistoryContextClient;
import com.edgechain.lib.context.domain.HistoryContext;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;

@RestController
@RequestMapping(value = "/v2/context")
public class HistoryContextController {

    @Autowired private RedisHistoryContextClient contextClient;

    @PostMapping("/create")
    public Single<HistoryContext> create() {
        return contextClient.create().toSingleWithRetry();
    }

    @PostMapping("/update")
    public Single<HistoryContext> update(@RequestBody HashMap<String, String> mapper) {
        return contextClient.put(mapper.get("key"), mapper.get("response")).toSingleWithRetry();
    }

    @GetMapping(value = "/{key}")
    public Single<HistoryContext> get(@PathVariable("key") String key) {
        return contextClient.get(key).toSingleWithRetry();
    }

    @GetMapping(value = "check/{key}")
    public Single<Boolean> check(@PathVariable("key") String key) {
        return contextClient.check(key).toSingleWithRetry();
    }

    @DeleteMapping("/{key}")
    public Completable delete(@PathVariable("key") String key) {
        return contextClient.delete(key).subscribeOn(Schedulers.io());
    }


}
