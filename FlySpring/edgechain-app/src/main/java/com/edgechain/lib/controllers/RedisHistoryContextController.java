package com.edgechain.lib.controllers;

import com.edgechain.lib.endpoint.impl.RedisHistoryContextEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import org.json.JSONObject;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController("App RedisHistoryContextController")
@RequestMapping("/v1/redis/historycontext")
public class RedisHistoryContextController {
    private RedisHistoryContextEndpoint endpoint;

    private RedisHistoryContextEndpoint getInstance() {
        if( Objects.isNull(endpoint))
          return  endpoint = new RedisHistoryContextEndpoint(new FixedDelay(2, 3, TimeUnit.SECONDS));

        else
            return endpoint;
    }

    @PostMapping
    public ArkResponse createRedisHistoryContext(@RequestParam(value = "id", defaultValue = "initialValue") String id) {
        if(id.equals("initialValue")) return new ArkResponse(getInstance().create(UUID.randomUUID().toString()));// Here randomId is generated.
        else return new ArkResponse(getInstance().create(id));
    }

    @PutMapping
    public ArkResponse putRedisHistoryContext(ArkRequest arkRequest) throws IOException {
        JSONObject json = arkRequest.getBody();
        return new ArkResponse(getInstance().put(json.getString("id"), json.getString("response")));
    }

    @GetMapping
    public ArkResponse getRedisHistoryContext(ArkRequest arkRequest) {
        String id = arkRequest.getQueryParam("id");
        return new ArkResponse(getInstance().get(id));
    }

    @DeleteMapping
    public void deleteRedisHistoryContext(ArkRequest arkRequest) {
        String id = arkRequest.getQueryParam("id");
        getInstance().delete(id);
    }

}
