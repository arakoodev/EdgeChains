package com.edgechain.service.controllers;

import com.edgechain.lib.openai.embeddings.providers.PineconeQueryProvider;
import com.edgechain.lib.openai.embeddings.providers.PineconeUpsertProvider;
import com.edgechain.lib.openai.embeddings.services.impl.PineconeEmbedding;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import com.edgechain.service.request.PineconeRequest;
import org.springframework.web.bind.annotation.*;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/index")
public class IndexController {

    @PostMapping("/pinecone/upsert")
    public Mono<ChainResponse> pineconeUpsert(@RequestBody PineconeRequest request){
        ChainProvider pineconeUpsert = new PineconeUpsertProvider(request.getEndpoint());

        ChainWrapper wrapper = new ChainWrapper();
        return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(request.getInput()),pineconeUpsert).toSingleWithRetry());
    }

    @PostMapping("/pinecone/query")
    public Mono<ChainResponse> pineconeQuery(@RequestBody PineconeRequest request){
        ChainProvider pineconeQuery = new PineconeQueryProvider(request.getEndpoint(), request.getTopK());

        ChainWrapper wrapper = new ChainWrapper();
        return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(request.getInput()),pineconeQuery).toSingleWithRetry());
    }


    @DeleteMapping("/pinecone/delete")
    public Mono<ChainResponse> pineconeDelete(@RequestBody PineconeRequest request){
        return RxJava3Adapter.singleToMono(new PineconeEmbedding(request.getEndpoint()).delete().toSingleWithRetry());
    }


}
