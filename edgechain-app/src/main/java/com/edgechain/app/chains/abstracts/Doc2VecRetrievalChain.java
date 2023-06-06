package com.edgechain.app.chains.abstracts;

import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.abstracts.IndexService;
import com.edgechain.app.services.embeddings.EmbeddingService;
import com.edgechain.lib.context.services.HistoryContextService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.response.ChainResponse;
import reactor.core.publisher.Mono;

import java.util.List;

public abstract class Doc2VecRetrievalChain extends RetrievalChain {


}
