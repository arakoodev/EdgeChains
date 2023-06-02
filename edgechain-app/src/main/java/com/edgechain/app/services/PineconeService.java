package com.edgechain.app.services;

import com.edgechain.app.request.PineconeRequest;
import com.edgechain.app.services.abstracts.IndexService;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(
        name = "pineconeService",
        url = "${feign.url}/index/pinecone"
)
@Component
public interface PineconeService extends IndexService {

    @Override
    @PostMapping("/upsert")
    ChainResponse upsert(@RequestBody PineconeRequest request);

    @Override
    @PostMapping("/query")
    ChainResponse query(@RequestBody PineconeRequest request);

    @Override
    @DeleteMapping("/delete")
    ChainResponse delete(@RequestBody PineconeRequest request);


}
