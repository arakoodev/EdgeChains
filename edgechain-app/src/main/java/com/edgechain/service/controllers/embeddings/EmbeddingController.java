package com.edgechain.service.controllers.embeddings;

import com.edgechain.lib.constants.WebConstants;
import com.edgechain.lib.embeddings.providers.Doc2VecEmbeddingProvider;
import com.edgechain.lib.embeddings.providers.OpenAiEmbeddingProvider;
import com.edgechain.lib.request.Doc2VecEmbeddingsRequest;
import com.edgechain.lib.request.OpenAiEmbeddingsRequest;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;
import io.reactivex.rxjava3.core.Single;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("Service EmbeddingController")
@RequestMapping(value = WebConstants.SERVICE_CONTEXT_PATH + "/embeddings")
public class EmbeddingController {

  /**
   * ChainProvider is a middle-ware which helps to execute multiple tasks simultaneously. E.g.
   * wrapper.chains(chain1, chain2, chain3) ... You can actually use providers implementation directly
   * as well...
   */
  @PostMapping("/openai")
  public Single<ChainResponse> openAiEmbeddings(@RequestBody OpenAiEmbeddingsRequest request) {
    ChainProvider embeddings = new OpenAiEmbeddingProvider(request.getEndpoint());

    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(request.getInput()), embeddings).toSingleWithRetry();
  }

  @PostMapping("/doc2vec")
  public Single<ChainResponse> doc2VecEmbeddings(@RequestBody Doc2VecEmbeddingsRequest request) {
    ChainProvider embeddings = new Doc2VecEmbeddingProvider(WebConstants.embeddingDoc2VecModel);
    ChainWrapper wrapper = new ChainWrapper();

    return wrapper.chains(new ChainRequest(request.getInput()), embeddings).toSingleWithRetry();
  }
}
