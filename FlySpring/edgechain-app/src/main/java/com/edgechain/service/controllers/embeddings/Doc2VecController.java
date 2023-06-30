package com.edgechain.service.controllers.embeddings;

import com.edgechain.lib.constants.WebConstants;
import com.edgechain.lib.embeddings.domain.doc2vec.Doc2VecRequest;
import com.edgechain.lib.embeddings.services.Doc2VecBuilder;
import com.edgechain.lib.rxjava.response.ChainResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import java.io.File;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("Service Doc2VecController")
@RequestMapping(value = WebConstants.SERVICE_CONTEXT_PATH + "/doc2vec")
public class Doc2VecController {

  @PostMapping
  public ChainResponse build(@RequestBody Doc2VecRequest doc2VecRequest) {

    Doc2VecBuilder doc2VecBuilder = new Doc2VecBuilder(doc2VecRequest);

    Completable.create(
            emitter -> {
              try {
                doc2VecBuilder.train(new File(doc2VecRequest.getFolderDirectory()));
              } catch (final Exception e) {
                emitter.onError(e.getCause());
              }
            })
        .subscribeOn(Schedulers.io())
        .subscribe();

    return new ChainResponse(
        "The model building has been started. For logging purpose, look into your console.");
  }
}
