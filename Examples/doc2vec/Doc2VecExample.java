package com.edgechain;

import com.edgechain.lib.chains.RedisRetrieval;
import com.edgechain.lib.chains.Retrieval;
import com.edgechain.lib.embeddings.request.Doc2VecRequest;
import com.edgechain.lib.endpoint.impl.Doc2VecEndpoint;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.reader.impl.PdfReader;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.deeplearning4j.models.paragraphvectors.ParagraphVectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class Doc2VecExample {

  private static Doc2VecEndpoint doc2VecEndpoint;
  private static RedisEndpoint redisEndpoint;

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    Properties properties = new Properties();

    properties.setProperty("redis.url", "");
    properties.setProperty("redis.port", "");
    properties.setProperty("redis.username", "default");
    properties.setProperty("redis.password", "");
    properties.setProperty("redis.ttl", "3600");

    new SpringApplicationBuilder(Doc2VecExample.class).properties(properties).run(args);

    doc2VecEndpoint = new Doc2VecEndpoint();
    redisEndpoint = new RedisEndpoint(new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));
  }

  @RestController
  @RequestMapping("/v1/examples")
  public class Doc2VecController {

    @Autowired private PdfReader pdfReader;

    /********************** REDIS WITH Doc2Vec ****************************/

    /********************** Doc2Vec Model Building *************************/
    @PostMapping("/doc2vec")
    public void buildDoc2Vec() {

      // Configuring parameters for our doc2vec model
      Doc2VecRequest doc2Vec = new Doc2VecRequest();
      doc2Vec.setFolderDirectory("./train_files");
      doc2Vec.setModelName("doc_vector"); // Will be stored as doc_vector.bin
      doc2Vec.setDestination("R:\\Github");
      doc2Vec.setEpochs(5);
      doc2Vec.setMinWordFrequency(5);
      doc2Vec.setLearningRate(0.025);
      doc2Vec.setLayerSize(1536);
      doc2Vec.setBatchSize(15);
      doc2Vec.setWindowSize(3);

      EdgeChain.fromObservable(doc2VecEndpoint.build(doc2Vec))
          .execute(); // Executing/Subscribing to Observable....
      // (Model has now started building; do check the console)

    }

    /** Pinecone & Doc2Vec Upsert * */
    @PostMapping("/redis/doc2vec/upsert") // /v1/examples/pinecone/doc2vec/upsert?namespace=doc2vec
    public void upsertRedisDoc2Vec(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      redisEndpoint.setIndexName("doc2vec_index");
      redisEndpoint.setNamespace(namespace);

      // Remember model is loaded once (this is just for example)
      ParagraphVectors paragraphVectors =
          WordVectorSerializer.readParagraphVectors(
              new FileInputStream("./doc_vector.bin"));

      String[] arr = pdfReader.readByChunkSize(file, 512);

      Retrieval retrieval =
          new RedisRetrieval(
              redisEndpoint, doc2VecEndpoint, 1536, RedisDistanceMetric.COSINE, arkRequest);
      IntStream.range(0, arr.length).parallel().forEach(i -> retrieval.upsert(arr[i]));
    }

    // Similarity Search
    @GetMapping(
        value = "/redis/doc2vec/similarity-search",
        produces = {MediaType.APPLICATION_JSON_VALUE})
    public ArkResponse redisDoc2VecSimilaritySearch(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      String query = arkRequest.getQueryParam("query");
      int topK = arkRequest.getIntQueryParam("topK");

      // Redis Searches by indexName.
      redisEndpoint.setIndexName("doc2vec_index");
      redisEndpoint.setNamespace(namespace);

      // Remember model is loaded once (this is just for example)
      ParagraphVectors paragraphVectors =
          WordVectorSerializer.readParagraphVectors(
              new FileInputStream("./doc_vector.bin"));

      return new EdgeChain<>(
              doc2VecEndpoint.embeddings(
                  query)) // Step 1: Generate embedding using OpenAI for provided input
          .transform(
              embeddings ->
                  EdgeChain.fromObservable(redisEndpoint.query(embeddings, topK))
                      .get()) // Step 2: Get the result from Redis
          .getArkResponse();
    }

    /** Delete Redis By Pattern Name * */
    @DeleteMapping("/redis/delete") // /v1/examples/redis/delete?pattern=machine-learning* (Will
    // delete all the
    // keys start with machine-learning namespace
    public void deleteRedis(ArkRequest arkRequest) {
      String patternName = arkRequest.getQueryParam("pattern");
      redisEndpoint.delete(patternName);
    }
  }
}
