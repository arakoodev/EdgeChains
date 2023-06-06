// usr/bin/env jbang "$0" "$@" ; exit $?
// DEPS org.springframework.boot:spring-boot-starter-webflux:2.6.2

package com.edgechain.service;

import com.edgechain.service.constants.ServiceConstants;
import com.edgechain.service.request.*;
import jakarta.annotation.PostConstruct;
import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.FileInputStream;

@SpringBootApplication(scanBasePackages = {"com.edgechain.service"})
public class EdgeChainServiceApplication {

  @PostConstruct
  public void init() throws Exception {
    this.readEmbeddingDoc2VecModel();
  }

  @PostConstruct
  public void init() throws Exception {
    this.readEmbeddingDoc2VecModel();
  }

  public static void main(String[] args) {
    System.setProperty("spring.application.name", "edgechain-service");
    System.setProperty("server.port", "8002");

    System.setProperty("spring.data.redis.host","");
    System.setProperty("spring.data.redis.port","");
    System.setProperty("spring.data.redis.username","");
    System.setProperty("spring.data.redis.password", "");

    SpringApplication.run(com.edgechain.service.EdgeChainServiceApplication.class, args);
  }

  private void readEmbeddingDoc2VecModel() throws Exception {
    String modelPath = "R:\\EdgeChain\\edgechain-app\\model\\doc_vectors.bin";

    File file = new File(modelPath);

    if (!file.exists())
      System.out.println("It seems like, you haven't trained the model or correctly specified Doc2Vec model path." +
              "For training Doc2Vec model, specify the directory, parameters by going to endpoint: localhost:8002/v1/doc2vec" +
              "{\n" +
              "    \"folderDirectory\": \"C:\\\\Users\\\\AnyUserName\\\\Desktop\\\\train_files\",\n" +
              "    \"modelName\": \"doc_vectors\",\n" +
              "    \"destination\": \"R:\\\\EdgeChain\\\\edgechain-app\\\\model\",\n" +
              "    \"epochs\": 5,\n" +
              "    \"minWordFrequency\": 5,\n" +
              "    \"learningRate\": 0.025,\n" +
              "    \"layerSize\": 300,\n" +
              "    \"batchSize\": 512,\n" +
              "    \"windowSize\": 15\n" +
              "}");

    else {
      System.out.println("Loading...");
      ServiceConstants.embeddingDoc2VecModel = WordVectorSerializer.readParagraphVectors(new FileInputStream(modelPath));
      System.out.println("Doc2Vec model is successfully loaded...");
    }
  }
  /**
   * You can define you own controllers like this: @RestController @RequestMapping("/v1/index")
   * public class IndexController { @PostMapping("/pinecone/upsert") public Mono<ChainResponse>
   * pineconeUpsert(@RequestBody PineconeRequest request){ ChainProvider pineconeUpsert = new
   * PineconeUpsertProvider(request.getEndpoint());
   *
   * <p>ChainWrapper wrapper = new ChainWrapper(); return
   * RxJava3Adapter.singleToMono(wrapper.chains(new
   * ChainRequest(request.getInput()),pineconeUpsert).toSingleWithRetry());
   * } @PostMapping("/pinecone/query") public Mono<ChainResponse> pineconeQuery(@RequestBody
   * PineconeRequest request){ ChainProvider pineconeQuery = new
   * PineconeQueryProvider(request.getEndpoint(), request.getTopK());
   *
   * <p>ChainWrapper wrapper = new ChainWrapper(); return
   * RxJava3Adapter.singleToMono(wrapper.chains(new
   * ChainRequest(request.getInput()),pineconeQuery).toSingleWithRetry());
   * } @DeleteMapping("/pinecone/delete") public Mono<ChainResponse> pineconeDelete(@RequestBody
   * PineconeRequest request){ return RxJava3Adapter.singleToMono(new
   * PineconeEmbedding(request.getEndpoint()).delete().toSingleWithRetry()); }
   *
   * <p>} @RestController @RequestMapping("/v1/openai") public class OpenAiController
   * { @PostMapping("/chat-completion") public Mono<ChainResponse> chatCompletion(@RequestBody
   * OpenAiChatRequest request) {
   *
   * <p>OpenAiChatCompletionProvider chatCompletion = new
   * OpenAiChatCompletionProvider(request.getEndpoint());
   *
   * <p>ChainWrapper wrapper = new ChainWrapper(); return
   * RxJava3Adapter.singleToMono(wrapper.chains(new
   * ChainRequest(request.getInput()),chatCompletion).toSingleWithRetry());
   * } @PostMapping("/completion") public Mono<ChainResponse> completion(@RequestBody
   * OpenAiCompletionRequest request) {
   *
   * <p>OpenAiCompletionProvider provider = new OpenAiCompletionProvider(request.getEndpoint());
   *
   * <p>ChainWrapper wrapper = new ChainWrapper(); return
   * RxJava3Adapter.singleToMono(wrapper.chains(new
   * ChainRequest(request.getInput()),provider).toSingleWithRetry()); } @PostMapping("/embeddings")
   * public Mono<ChainResponse> embeddings(@RequestBody OpenAiEmbeddingsRequest request) {
   * ChainProvider embeddings = new OpenAiEmbeddingProvider(request.getEndpoint());
   *
   * <p>ChainWrapper wrapper = new ChainWrapper(); return
   * RxJava3Adapter.singleToMono(wrapper.chains(new
   * ChainRequest(request.getInput()),embeddings).toSingleWithRetry()); }
   *
   * <p>} @RestController @RequestMapping("/v1/prompt") public class PromptController
   * { @GetMapping("/wiki-summary") public Mono<ChainResponse> getWikiSummaryPrompt() { return
   * Mono.just(new ChainResponse(new WikiSummaryPrompt().getPrompt()));
   * } @GetMapping("/index-query") public Mono<ChainResponse> getIndexQueryPrompt() { return
   * Mono.just(new ChainResponse(new IndexQueryPrompt().getPrompt())); }
   *
   * <p>} @RestController @RequestMapping("/v1/plugins") public class PluginController
   * { @GetMapping("/wiki") public Mono<ChainResponse> wikiContent(@RequestParam("query") String
   * query) { WikiProvider wikiProvider = new WikiProvider(); ChainWrapper wrapper = new
   * ChainWrapper(); return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(query),
   * wikiProvider).toSingleWithRetry()); } @PostMapping("/with-api") public Mono<ChainResponse>
   * getAPI(@RequestBody PluginAPIRequest request) { OpenAiCompletionProvider provider = new
   * OpenAiCompletionProvider(request.getEndpoint()); ChainProvider chainProvider = new
   * PluginAPIProvider(provider, request.getPluginEndpoint(), request.getSpecEndpoint());
   * ChainWrapper wrapper = new ChainWrapper(); return
   * RxJava3Adapter.singleToMono(wrapper.chains(new
   * ChainRequest(request.getInput()),chainProvider).toSingleWithRetry()); }
   *
   * <p>}
   */
}
