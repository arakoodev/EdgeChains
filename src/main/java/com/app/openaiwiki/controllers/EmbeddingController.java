package com.app.openaiwiki.controllers;

import com.app.openai.embeddings.service.impl.PineconeEmbeddingService;
import com.app.openai.endpoint.Endpoint;
import com.app.openaiwiki.services.impl.PDFEmbeddingService;
import com.app.rxjava.retry.impl.ExponentialDelay;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/embeddings")
public class EmbeddingController {

  private static final String OPENAI_EMBEDDINGS_API = "https://api.openai.com/v1/embeddings";
  private static final String OPENAI_API_KEY =
      "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";

  private static final String PINECONE_QUERY_API =
      "https://pinecone-index-a464f61.svc.us-east-1-aws.pinecone.io/query";
  private static final String PINECONE_UPSERT_API =
      "https://pinecone-index-a464f61.svc.us-east-1-aws.pinecone.io/vectors/upsert";
  private static final String PINECONE_DELETE_API =
      "https://pinecone-index-a464f61.svc.us-east-1-aws.pinecone.io/vectors/delete";
  private static final String PINECONE_API_KEY = "";

  @PostMapping("/pinecone/upsert")
  public Observable<String> upsertPinecone(@RequestParam("file") MultipartFile file) {
    return new PDFEmbeddingService(
            new PineconeEmbeddingService(new Endpoint(PINECONE_UPSERT_API, PINECONE_API_KEY)),
            new Endpoint(
                OPENAI_EMBEDDINGS_API,
                OPENAI_API_KEY,
                new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS)),
            512)
        .upsert(file)
        .getScheduledObservableWithoutRetry();
  }

  @PostMapping("/pinecone/delete")
  public Observable<String> deletePinecone() {
    return new PineconeEmbeddingService(new Endpoint(PINECONE_DELETE_API, PINECONE_API_KEY))
        .delete()
        .getScheduledObservableWithoutRetry();
  }

  /*
  Query = I have a breach in my contract specifically regarding consideration not being performed by one party. What would apply to my situation? Can you give me a very detailed answer?
  Query = What is formal language theory?
  Query = What is the collect stage of data maturity?
  Query = What is membership model in data science?
   */
  @PostMapping("/pinecone/query")
  public Observable<String> queryPinecone(@RequestBody HashMap<String, String> mapper) {
    return new PineconeEmbeddingService(new Endpoint(PINECONE_QUERY_API, PINECONE_API_KEY))
        .predict(mapper.get("query"), 0.0, OPENAI_API_KEY)
        .getScheduledObservableWithoutRetry();
  }
}
