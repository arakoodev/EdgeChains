package com.edgechain.service.controllers.bgeSmall;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.embeddings.bgeSmall.BgeSmallClient;
import com.edgechain.lib.embeddings.bgeSmall.response.BgeSmallResponse;
import com.edgechain.lib.endpoint.impl.embeddings.BgeSmallEndpoint;
import com.edgechain.lib.logger.entities.EmbeddingLog;
import com.edgechain.lib.logger.services.EmbeddingLogService;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;

@RestController("Service BgeSmallController")
@RequestMapping(WebConfiguration.CONTEXT_PATH + "/bgeSmall")
public class BgeSmallController {

  @Autowired private BgeSmallClient bgeSmallClient;

  @Autowired private EmbeddingLogService embeddingLogService;

  @Autowired private Environment env;

  @PostMapping
  public Single<BgeSmallResponse> embeddings(@RequestBody BgeSmallEndpoint bgeSmallEndpoint) {

    EdgeChain<BgeSmallResponse> edgeChain =
        this.bgeSmallClient.createEmbeddings(bgeSmallEndpoint.getRawText(), bgeSmallEndpoint);

    if (Objects.nonNull(env.getProperty("postgres.db.host"))) {

      EmbeddingLog embeddingLog = new EmbeddingLog();
      embeddingLog.setCreatedAt(LocalDateTime.now());
      embeddingLog.setCallIdentifier(bgeSmallEndpoint.getCallIdentifier());
      embeddingLog.setModel("bge-small-en");

      return edgeChain
          .doOnNext(
              c -> {
                embeddingLog.setCompletedAt(LocalDateTime.now());
                Duration duration =
                    Duration.between(embeddingLog.getCreatedAt(), embeddingLog.getCompletedAt());
                embeddingLog.setLatency(duration.toMillis());
                embeddingLogService.saveOrUpdate(embeddingLog);
              })
          .toSingleWithoutScheduler();
    }

    return edgeChain.toSingleWithoutScheduler();
  }
}
