//usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS org.springframework.boot:spring-boot-starter-webflux:2.6.2


package com.edgechain.service;
import com.edgechain.service.prompts.IndexQueryPrompt;
import com.edgechain.service.prompts.WikiSummaryPrompt;
import com.edgechain.service.request.*;
import com.edgechain.service.wiki.WikiProvider;
import com.edgechain.lib.openai.embeddings.providers.PineconeQueryProvider;
import com.edgechain.lib.openai.embeddings.providers.PineconeUpsertProvider;
import com.edgechain.lib.openai.embeddings.services.impl.PineconeEmbedding;
import com.edgechain.lib.openai.plugin.providers.PluginAPIProvider;
import com.edgechain.lib.openai.providers.OpenAiChatCompletionProvider;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.openai.providers.OpenAiEmbeddingProvider;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;


@SpringBootApplication(scanBasePackages = {"com.edgechain.service"})
public class EdgeChainServiceApplication {

  public static void main(String[] args) {
    System.setProperty("spring.application.name","edgechain-service");
    System.setProperty("server.port","8001");
    SpringApplication.run(EdgeChainServiceApplication.class, args);
  }

  /**
   *  You can define you own controllers like this:
   *    @RestController
   *   @RequestMapping("/v1/index")
   *   public class IndexController {
   *
   *     @PostMapping("/pinecone/upsert")
   *     public Mono<ChainResponse> pineconeUpsert(@RequestBody PineconeRequest request){
   *       ChainProvider pineconeUpsert = new PineconeUpsertProvider(request.getEndpoint());
   *
   *       ChainWrapper wrapper = new ChainWrapper();
   *       return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(request.getInput()),pineconeUpsert).toSingleWithRetry());
   *     }
   *
   *     @PostMapping("/pinecone/query")
   *     public Mono<ChainResponse> pineconeQuery(@RequestBody PineconeRequest request){
   *       ChainProvider pineconeQuery = new PineconeQueryProvider(request.getEndpoint(), request.getTopK());
   *
   *       ChainWrapper wrapper = new ChainWrapper();
   *       return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(request.getInput()),pineconeQuery).toSingleWithRetry());
   *     }
   *
   *
   *     @DeleteMapping("/pinecone/delete")
   *     public Mono<ChainResponse> pineconeDelete(@RequestBody PineconeRequest request){
   *       return RxJava3Adapter.singleToMono(new PineconeEmbedding(request.getEndpoint()).delete().toSingleWithRetry());
   *     }
   *
   *   }
   *
   *   @RestController
   *   @RequestMapping("/v1/openai")
   *   public class OpenAiController {
   *
   *     @PostMapping("/chat-completion")
   *     public Mono<ChainResponse> chatCompletion(@RequestBody OpenAiChatRequest request) {
   *
   *       OpenAiChatCompletionProvider chatCompletion = new OpenAiChatCompletionProvider(request.getEndpoint());
   *
   *       ChainWrapper wrapper = new ChainWrapper();
   *       return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(request.getInput()),chatCompletion).toSingleWithRetry());
   *     }
   *
   *     @PostMapping("/completion")
   *     public Mono<ChainResponse> completion(@RequestBody OpenAiCompletionRequest request) {
   *
   *       OpenAiCompletionProvider provider = new OpenAiCompletionProvider(request.getEndpoint());
   *
   *       ChainWrapper wrapper = new ChainWrapper();
   *       return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(request.getInput()),provider).toSingleWithRetry());
   *     }
   *
   *     @PostMapping("/embeddings")
   *     public Mono<ChainResponse> embeddings(@RequestBody OpenAiEmbeddingsRequest request) {
   *       ChainProvider embeddings = new OpenAiEmbeddingProvider(request.getEndpoint());
   *
   *       ChainWrapper wrapper = new ChainWrapper();
   *       return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(request.getInput()),embeddings).toSingleWithRetry());
   *     }
   *
   *   }
   *
   *   @RestController
   *   @RequestMapping("/v1/prompt")
   *   public class PromptController {
   *
   *
   *     @GetMapping("/wiki-summary")
   *     public Mono<ChainResponse> getWikiSummaryPrompt() {
   *       return Mono.just(new ChainResponse(new WikiSummaryPrompt().getPrompt()));
   *     }
   *
   *     @GetMapping("/index-query")
   *     public Mono<ChainResponse> getIndexQueryPrompt() {
   *       return Mono.just(new ChainResponse(new IndexQueryPrompt().getPrompt()));
   *     }
   *
   *
   *   }
   *
   *
   *   @RestController
   *   @RequestMapping("/v1/plugins")
   *   public class PluginController {
   *
   *     @GetMapping("/wiki")
   *     public Mono<ChainResponse> wikiContent(@RequestParam("query") String query) {
   *       WikiProvider wikiProvider = new WikiProvider();
   *       ChainWrapper wrapper = new ChainWrapper();
   *       return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(query), wikiProvider).toSingleWithRetry());
   *     }
   *
   *     @PostMapping("/with-api")
   *     public Mono<ChainResponse> getAPI(@RequestBody PluginAPIRequest request) {
   *       OpenAiCompletionProvider provider = new OpenAiCompletionProvider(request.getEndpoint());
   *       ChainProvider chainProvider = new PluginAPIProvider(provider, request.getPluginEndpoint(), request.getSpecEndpoint());
   *       ChainWrapper wrapper  = new ChainWrapper();
   *       return RxJava3Adapter.singleToMono(wrapper.chains(new ChainRequest(request.getInput()),chainProvider).toSingleWithRetry());
   *     }
   *
   *   }
   */



}