package com.edgechain.app.chains.retrieval.doc2vec;

import com.edgechain.app.chains.abstracts.RetrievalChain;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.embeddings.EmbeddingService;
import com.edgechain.app.services.index.PineconeService;
import com.edgechain.app.services.index.RedisService;
import com.edgechain.lib.context.HistoryContext;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.request.*;
import com.edgechain.lib.resource.ResourceHandler;
import com.edgechain.lib.rxjava.response.ChainResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.StringTokenizer;

public class RedisDoc2VecRetrievalChain extends RetrievalChain {

    private Endpoint chatEndpoint;
    private final EmbeddingService embeddingService;
    private final RedisService redisService;
    private PromptService promptService;
    private OpenAiService openAiService;


    // For Upsert
    public RedisDoc2VecRetrievalChain(EmbeddingService embeddingService, RedisService redisService) {
        this.embeddingService = embeddingService;
        this.redisService = redisService;
    }

    // For Query
    public RedisDoc2VecRetrievalChain(Endpoint chatEndpoint, EmbeddingService embeddingService, RedisService redisService, PromptService promptService, OpenAiService openAiService) {
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
                                this.embeddingService.doc2Vec(new Doc2VecEmbeddingsRequest(input)).getResponse()).map(
                                embeddingOutput ->
                                        this.redisService
                                                .upsert(new RedisRequest(embeddingOutput))
                                                .getResponse()))
                .blockingAwait();
    }



    @Override
    public Mono<List<ChainResponse>> query(String queryText, int topK) {

        return RxJava3Adapter.singleToMono(
                Observable.just(
                                this.embeddingService.doc2Vec(new Doc2VecEmbeddingsRequest(queryText))
                                        .getResponse())
                        .map(
                                embeddingOutput -> {

                                    List<ChainResponse> chainResponseList = new ArrayList<>();

                                    String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();

                                    StringTokenizer tokenizer =
                                            new StringTokenizer(
                                                    this.redisService.query(new RedisRequest(embeddingOutput, topK)).getResponse(),
                                                    "\n");
                                    while (tokenizer.hasMoreTokens()) {

                                        String input = promptResponse + "\n" + tokenizer.nextToken();
                                        chainResponseList.add(
                                                this.openAiService
                                                        .chatCompletion(new OpenAiChatRequest(this.chatEndpoint, input)));
                                    }

                                    return chainResponseList;
                                })
                        .subscribeOn(Schedulers.io())
                        .firstOrError());
    }

    @Override
    public Mono<List<ChainResponse>> query(String queryText, int topK, HistoryContextService contextService) {

       return RxJava3Adapter.singleToMono(

                Observable.just(this.embeddingService.doc2Vec(new Doc2VecEmbeddingsRequest(queryText)).getResponse())
                        .map(embeddingOutput -> {

                            List<String> ids = new ArrayList<>();

                            StringTokenizer tokenizer =
                                    new StringTokenizer(
                                            this.redisService.query(new RedisRequest(embeddingOutput, topK)).getResponse(),
                                            "\n");

                            while (tokenizer.hasMoreTokens()) {

                                String value = tokenizer.nextToken();
                                System.out.println(value);

                                HistoryContext context = contextService.put(value).blockingGet();
                                ids.add(context.getId());
                            }

                            return ids;
                        })
                        .map(ids -> {
                            String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();

                            List<ChainResponse> chainResponseList = new ArrayList<>();

                            Iterator<String> iterator = ids.iterator();
                            while(iterator.hasNext()) {

                                String input = promptResponse + "\n" +  contextService.findById(iterator.next()).blockingGet().getValue();
                                chainResponseList.add(
                                        this.openAiService.chatCompletion(new OpenAiChatRequest(this.chatEndpoint, input)));
                            }

                            contextService.deleteAllByIds(ids).subscribe();

                            return chainResponseList;
                        }).subscribeOn(Schedulers.io()).firstOrError()
        );
    }

    @Override
    public Mono<ChainResponse> query(String queryText, int topK, HistoryContextService contextService, ResourceHandler resourceHandler) {


        return RxJava3Adapter.singleToMono(

                Observable.just(this.embeddingService.doc2Vec(new Doc2VecEmbeddingsRequest(queryText)).getResponse())
                        .map(embeddingOutput -> {

                            List<String> ids = new ArrayList<>();

                            StringTokenizer tokenizer =
                                    new StringTokenizer(
                                            this.redisService.query(new RedisRequest(embeddingOutput, topK)).getResponse(),
                                            "\n");

                            while (tokenizer.hasMoreTokens()) {
                                String value = tokenizer.nextToken();
                                HistoryContext context = contextService.put(value).blockingGet();
                                ids.add(context.getId());
                            }

                            return ids;
                        })
                        .map(ids -> {
                            String promptResponse = this.promptService.getIndexQueryPrompt().getResponse();

                            StringBuilder stringBuilder = new StringBuilder();

                            Iterator<String> iterator = ids.iterator();
                            while (iterator.hasNext()) {
                                String input = promptResponse + "\n" +contextService.findById(iterator.next()).blockingGet().getValue();
                                stringBuilder
                                        .append(this.openAiService.chatCompletion(new OpenAiChatRequest(this.chatEndpoint, input)).getResponse());
                            }
                            contextService.deleteAllByIds(ids).subscribe();
                            resourceHandler.upload(stringBuilder);
                            return new ChainResponse("File has been successfully written.");
                        }).subscribeOn(Schedulers.io()).firstOrError()
        );

    }

}
