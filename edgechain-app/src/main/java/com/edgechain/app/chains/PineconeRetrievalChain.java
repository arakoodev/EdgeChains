package com.edgechain.app.chains;

import com.edgechain.app.chains.abstracts.RetrievalChain;
import com.edgechain.app.request.OpenAiChatRequest;
import com.edgechain.app.request.OpenAiEmbeddingsRequest;
import com.edgechain.app.request.PineconeRequest;
import com.edgechain.app.services.abstracts.IndexService;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.response.ChainResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import java.util.StringTokenizer;

public class PineconeRetrievalChain extends RetrievalChain {


    public PineconeRetrievalChain(Endpoint embeddingEndpoint, Endpoint indexEndpoint, OpenAiService openAiService, IndexService indexService) {
        super(embeddingEndpoint, indexEndpoint, openAiService, indexService);
    }

    public PineconeRetrievalChain(Endpoint embeddingEndpoint, Endpoint indexEndpoint, Endpoint chatEndpoint, OpenAiService openAiService, PromptService promptService, IndexService indexService) {
        super(embeddingEndpoint, indexEndpoint, chatEndpoint, openAiService, promptService, indexService);
    }

    public PineconeRetrievalChain(Endpoint indexEndpoint, IndexService indexService) {
        super(indexEndpoint, indexService);
    }

    @Override
    public void upsert(String input) {
        Completable.fromObservable(
                Observable.just(this.getOpenAiService().embeddings(new OpenAiEmbeddingsRequest(this.getEmbeddingEndpoint(), input)).getResponse())
                        .map(embeddingOutput -> this.getIndexService().upsert(new PineconeRequest(this.getIndexEndpoint(), embeddingOutput)).getResponse())
        ).blockingAwait();
    }

    @Override
    public Mono<List<ChainResponse>> query(String queryText, int topK) {
        List<ChainResponse> chainResponseList = new ArrayList<>();

        return RxJava3Adapter.singleToMono(
                Observable.just(this.getOpenAiService().embeddings(new OpenAiEmbeddingsRequest(this.getEmbeddingEndpoint(), queryText)).getResponse())
                        .map(embeddingOutput -> {
                            String promptResponse = this.getPromptService().getIndexQueryPrompt().getResponse();

                            StringTokenizer tokenizer = new StringTokenizer(this.getIndexService().query(new PineconeRequest(this.getIndexEndpoint(), embeddingOutput, topK)).getResponse(),"\n");
                            while (tokenizer.hasMoreTokens()) {
                                String input = tokenizer.nextToken() + "\n" + promptResponse;
                                chainResponseList.add(this.getOpenAiService().chatCompletion(new OpenAiChatRequest(this.getChatEndpoint(), input)));
                            }

                            return chainResponseList;
                        })
                        .subscribeOn(Schedulers.io())
                        .firstOrError()
        );
    }

    @Override
    public ChainResponse delete() {
        return this.getIndexService().delete(new PineconeRequest(this.getIndexEndpoint()));
    }
}
