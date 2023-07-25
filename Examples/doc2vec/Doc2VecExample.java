package com.edgechain;


import com.edgechain.lib.chains.RedisRetrieval;
import com.edgechain.lib.chains.Retrieval;
import com.edgechain.lib.configuration.domain.CorsEnableOrigins;
import com.edgechain.lib.configuration.domain.ExcludeMappingFilter;
import com.edgechain.lib.configuration.domain.RedisEnv;
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
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
public class Doc2VecExample {

  public static void main(String[] args) {
    System.setProperty("server.port", "8080");
    SpringApplication.run(Doc2VecExample.class, args);
  }

  // Adding Cors ==> You can configure multiple cors w.r.t your urls.;
  @Bean
  @Primary
  public CorsEnableOrigins corsEnableOrigins() {
    CorsEnableOrigins origins = new CorsEnableOrigins();
    origins.setOrigins(Arrays.asList("http://localhost:4200", "http://localhost:4201"));
    return origins;
  }

  /* Optional (not required if you are not using Redis), always create bean with @Primary annotation */
  @Bean
  @Primary
  public RedisEnv redisEnv() {
    RedisEnv redisEnv = new RedisEnv();
    redisEnv.setUrl("");
    redisEnv.setPort(12285);
    redisEnv.setUsername("default");
    redisEnv.setPassword("");
    redisEnv.setTtl(3600); // Configuring ttl for HistoryContext;
    return redisEnv;
  }

  /**
   * Optional, Create it to exclude api calls from filtering; otherwise API calls will filter via
   * ROLE_BASE access *
   */
  @Bean
  @Primary
  public ExcludeMappingFilter mappingFilter() {
    ExcludeMappingFilter mappingFilter = new ExcludeMappingFilter();
    mappingFilter.setRequestPost(List.of("/v1/examples/**"));
    mappingFilter.setRequestGet(List.of("/v1/examples/**"));
    mappingFilter.setRequestDelete(List.of("/v1/examples/**"));
    mappingFilter.setRequestPut(List.of("/v1/examples/**"));
    return mappingFilter;
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
      doc2Vec.setFolderDirectory("R:\\Github\\train_files");
      doc2Vec.setModelName("doc_vector"); // Will be stored as doc_vector.bin
      doc2Vec.setDestination("R:\\Github");
      doc2Vec.setEpochs(5);
      doc2Vec.setMinWordFrequency(5);
      doc2Vec.setLearningRate(0.025);
      doc2Vec.setLayerSize(1536);
      doc2Vec.setBatchSize(15);
      doc2Vec.setWindowSize(3);

      Doc2VecEndpoint endpoint = new Doc2VecEndpoint();
      EdgeChain.fromObservable(endpoint.build(doc2Vec))
          .execute(); // Executing/Subscribing to Observable....
      // (Model has now started building; do check the console)

    }

    /** Pinecone & Doc2Vec Upsert * */
    @PostMapping("/redis/doc2vec/upsert") // /v1/examples/pinecone/doc2vec/upsert?namespace=doc2vec
    public void upsertRedisDoc2Vec(ArkRequest arkRequest) throws IOException {

      String namespace = arkRequest.getQueryParam("namespace");
      InputStream file = arkRequest.getMultiPart("file").getInputStream();

      RedisEndpoint redisEndpoint =
          new RedisEndpoint(
              "doc2vec_index", namespace, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      // Remember model is loaded once (this is just for example)
      ParagraphVectors paragraphVectors =
          WordVectorSerializer.readParagraphVectors(
              new FileInputStream("R:\\Github\\doc_vector.bin"));

      Doc2VecEndpoint embeddingEndpoint = new Doc2VecEndpoint(paragraphVectors);

      String[] arr = pdfReader.readByChunkSize(file, 512);

      Retrieval retrieval =
          new RedisRetrieval(redisEndpoint, embeddingEndpoint, 1536, RedisDistanceMetric.COSINE);
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
      RedisEndpoint redisEndpoint =
          new RedisEndpoint(
              "doc2vec_index", namespace, new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

      // Remember model is loaded once (this is just for example)
      ParagraphVectors paragraphVectors =
          WordVectorSerializer.readParagraphVectors(
              new FileInputStream("R:\\Github\\doc_vector.bin"));

      Doc2VecEndpoint embeddingEndpoint = new Doc2VecEndpoint(paragraphVectors);

      return new EdgeChain<>(
              embeddingEndpoint.getEmbeddings(
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
      RedisEndpoint redisEndpoint = new RedisEndpoint();
      redisEndpoint.delete(patternName);
    }
  }
}
