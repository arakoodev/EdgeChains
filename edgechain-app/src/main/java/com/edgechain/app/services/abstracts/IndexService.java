package com.edgechain.app.services.abstracts;

import com.edgechain.app.request.PineconeRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

public interface IndexService {

    ChainResponse upsert(@RequestBody PineconeRequest request);

    ChainResponse query(@RequestBody PineconeRequest request);

    ChainResponse delete(@RequestBody PineconeRequest request);

}
