package com.edgechain.app.controllers;

import com.edgechain.app.chains.PineconeRetrievalChain;
import com.edgechain.app.chains.abstracts.RetrievalChain;
import com.edgechain.app.services.*;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.app.constants.WebConstants;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.app.extractor.PdfExtractor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

@RestController
@RequestMapping("/v1/pinecone")
public class PineconeController {

    private static final String OPENAI_CHAT_COMPLETION_API = "https://api.openai.com/v1/chat/completions";
    private static final String OPENAI_EMBEDDINGS_API = "https://api.openai.com/v1/embeddings";
    private static final String PINECONE_AUTH_KEY = "YOUR_API_KEY";
    private static final String PINECONE_QUERY_API = "https://pinecone-index-a464f61.svc.us-east-1-aws.pinecone.io/query";
    private static final String PINECONE_UPSERT_API = "https://pinecone-index-a464f61.svc.us-east-1-aws.pinecone.io/vectors/upsert";
    private static final String PINECONE_DELETE_API = "https://pinecone-index-a464f61.svc.us-east-1-aws.pinecone.io/vectors/delete";

    @Autowired private PdfExtractor pdfExtractor;
    @Autowired private OpenAiService openAiService;
    @Autowired private PromptService promptService;
    @Autowired private PineconeService pineconeService;

    @PostMapping("/upsert")
    public void upsert(@RequestBody MultipartFile file) {

        String[] arr = pdfExtractor.extract(file, 512);
        IntStream.range(0, arr.length)
                .parallel()
                .forEach(i -> {

                    Endpoint embeddingEndpoint = new Endpoint(
                            OPENAI_EMBEDDINGS_API,
                            WebConstants.OPENAI_AUTH_KEY,
                            "text-embedding-ada-002",
                            new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS)
                    );

                    Endpoint pineconeEndpoint = new Endpoint(
                            PINECONE_UPSERT_API,
                            PINECONE_AUTH_KEY,
                            new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS)
                    );

                    RetrievalChain retrievalChain = new PineconeRetrievalChain(embeddingEndpoint, pineconeEndpoint,openAiService, pineconeService);
                    retrievalChain.upsert(arr[i]);
                });
    }

    @PostMapping("/query")
    public Mono<List<ChainResponse>> query(@RequestBody HashMap<String, String> mapper) {

        Endpoint embeddingEndpoint = new Endpoint(
                OPENAI_EMBEDDINGS_API,
                WebConstants.OPENAI_AUTH_KEY,
                "text-embedding-ada-002",
                new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS)
        );

        Endpoint pineconeEndpoint = new Endpoint(
                PINECONE_QUERY_API,
                PINECONE_AUTH_KEY
        );

        Endpoint chatEndpoint = new Endpoint(
                        OPENAI_CHAT_COMPLETION_API,
                        WebConstants.OPENAI_AUTH_KEY,
                        "gpt-3.5-turbo",
                        "user",
                        0.4,
                        new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS)
        );

        RetrievalChain retrievalChain = new PineconeRetrievalChain(embeddingEndpoint, pineconeEndpoint, chatEndpoint, openAiService, promptService, pineconeService);
        return retrievalChain.query(mapper.get("query"), Integer.parseInt(mapper.get("topK")));
    }

    @DeleteMapping("/delete")
    public ChainResponse delete() {

        Endpoint pineconeEndpoint = new Endpoint(
                PINECONE_DELETE_API,
                PINECONE_AUTH_KEY,
                new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS)
        );

        RetrievalChain retrievalChain = new PineconeRetrievalChain(pineconeEndpoint, pineconeService);
        return retrievalChain.delete();
    }



}
