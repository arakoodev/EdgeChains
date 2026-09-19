package com.edgechain.service.controllers.miniLM;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.embeddings.miniLLM.MiniLMClient;
import com.edgechain.lib.embeddings.miniLLM.response.MiniLMResponse;
import com.edgechain.lib.endpoint.impl.embeddings.MiniLMEndpoint;
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

@RestController("Service MiniLMController")
@RequestMapping(WebConfiguration.CONTEXT_PATH + "/miniLM")
public class MiniLMController {

  @Autowired private MiniLMClient miniLMClient;

  @Autowired private EmbeddingLogService embeddingLogService;

  @Autowired private Environment env;

  @PostMapping
  public Single<MiniLMResponse> embeddings(@RequestBody MiniLMEndpoint miniLMEndpoint) {

    EdgeChain<MiniLMResponse> edgeChain =
        this.miniLMClient.createEmbeddings(miniLMEndpoint.getRawText(), miniLMEndpoint);

    if (Objects.nonNull(env.getProperty("postgres.db.host"))) {

      EmbeddingLog embeddingLog = new EmbeddingLog();
      embeddingLog.setCreatedAt(LocalDateTime.now());
      embeddingLog.setCallIdentifier(miniLMEndpoint.getCallIdentifier());
      embeddingLog.setModel(miniLMEndpoint.getMiniLMModel().getName());

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
