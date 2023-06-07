package com.edgechain.app.chains.retrieval.openai;

import com.edgechain.app.chains.abstracts.RetrievalChain;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.embeddings.EmbeddingService;
import com.edgechain.app.services.index.RedisService;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.*;
import com.edgechain.lib.resource.ResourceHandler;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import java.util.StringTokenizer;

public class RedisOpenAiRetrievalChain extends RetrievalChain {

    private final Endpoint embeddingEndpoint;
    private Endpoint chatEndpoint;
    private final EmbeddingService embeddingService;
    private final RedisService redisService;
    private PromptService promptService;
    private OpenAiService openAiService;

    public RedisOpenAiRetrievalChain(Endpoint embeddingEndpoint, EmbeddingService embeddingService, RedisService redisService) {
        this.embeddingEndpoint = embeddingEndpoint;
        this.embeddingService = embeddingService;
        this.redisService = redisService;
    }

    public RedisOpenAiRetrievalChain(Endpoint embeddingEndpoint, Endpoint chatEndpoint, EmbeddingService embeddingService, RedisService redisService, PromptService promptService, OpenAiService openAiService) {
        this.embeddingEndpoint = embeddingEndpoint;
        this.chatEndpoint = chatEndpoint;
        this.embeddingService = embeddingService;
        this.redisService = redisService;
        this.promptService = promptService;
        this.openAiService = openAiService;
    }

    @Override
    public void upsert(String input) {
        Completable.fromObservable(
                Observable.just(
                        this.embeddingService.openAi(new OpenAiEmbeddingsRequest(this.embeddingEndpoint, input)).getResponse()).map(
                        embeddingOutput ->
                                this.redisService.upsert(new RedisRequest(embeddingOutput)).getResponse())
        ).blockingAwait();
    }


    @Override
    public Mono<List<ChainResponse>> query(String queryText, int topK) {
        return RxJava3Adapter.singleToMono(
                new EdgeChain<>(
                        Observable.just(
                                        this.embeddingService.openAi(new OpenAiEmbeddingsRequest(this.embeddingEndpoint, queryText))
                                                .getResponse())
                                .map(
                                        embeddingOutput -> {
                                            String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();

                                            List<ChainResponse> chainResponseList = new ArrayList<>();

                                            StringTokenizer tokenizer =
                                                    new StringTokenizer(
                                                            this.redisService.query(new RedisRequest(embeddingOutput, topK)).getResponse(),
                                                            "\n");
                                            while (tokenizer.hasMoreTokens()) {
                                                String input = promptResponse + "\n" + tokenizer.nextToken();
                                                chainResponseList.add(
                                                        this.openAiService.chatCompletion(new OpenAiChatRequest(this.chatEndpoint, input))
                                                );
                                            }

                                            return chainResponseList;
                                        })
                ).toSingleWithRetry()
        );
    }

    @Override
    public Mono<ChainResponse> query(String contextId, HistoryContextService contextService, String queryText) {
        return RxJava3Adapter.singleToMono(
                new EdgeChain<>(
                        Observable.just(this.embeddingService.openAi(new OpenAiEmbeddingsRequest(this.embeddingEndpoint, queryText)).getResponse())
                                .map(embeddingOutput ->
                                        this.queryWithChatHistory(embeddingOutput, contextId, contextService, queryText)
                                )
                ).toSingleWithRetry());
    }

    @Override
    public Mono<ChainResponse> query(String contextId, HistoryContextService contextService, ResourceHandler resourceHandler) {
        HistoryContext context = contextService.get(contextId).getWithRetry();
        resourceHandler.upload(context.getResponse());
        return Mono.just(new ChainResponse("File is successfully uploaded to the provided destination"));
    }

    private ChainResponse queryWithChatHistory(
            String embeddingOutput, String contextId, HistoryContextService contextService, String queryText) {

        // Get the Prompt & The Context History

        String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();
        HistoryContext historyContext = contextService.get(contextId).toSingleWithRetry().blockingGet();

        String chatHistory = historyContext.getResponse();

        String indexResponse = this.redisService.query(new RedisRequest(embeddingOutput, 1)).getResponse();

        int totalTokens = promptResponse.length() + chatHistory.length() + indexResponse.length() + queryText.length();

        if (totalTokens > historyContext.getMaxTokens()) {
            int diff = historyContext.getMaxTokens() - totalTokens;
            chatHistory = chatHistory.substring(diff + 1);
        }

        // Then, Create Prompt For OpenAI
        String prompt;

        if (chatHistory.length() > 0) {
            prompt = "Question: " + queryText + "\n " + promptResponse + "\n" + indexResponse + "\nChat history:\n" + chatHistory;
        } else {
            prompt = "Question: " + queryText + "\n " + promptResponse + "\n" + indexResponse;
        }

        System.out.println("Prompt: " + prompt);

        ChainResponse openAiResponse = this.openAiService.chatCompletion(new OpenAiChatRequest(this.chatEndpoint, prompt));

        String redisHistory = chatHistory + queryText + openAiResponse.getResponse();

//      System.out.println("Chat History: "+redisHistory);

        contextService.put(contextId, redisHistory).execute();

        return openAiResponse;
    }

}
