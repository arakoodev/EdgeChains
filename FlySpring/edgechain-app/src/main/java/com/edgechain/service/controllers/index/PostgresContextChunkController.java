package com.edgechain.service.controllers.index;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.client.impl.PostgresContextChunkClient;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Single;
import org.springframework.context.annotation.Lazy;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController("Service PostgresContextChunkController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/index/postgres")
public class PostgresContextChunkController {
    @Lazy
    private final PostgresContextChunkClient postgresClient;

    public PostgresContextChunkController(PostgresContextChunkClient postgresClient) {
        this.postgresClient = postgresClient;
    }
    @PostMapping("/upsert-embeddings")
    public Single<StringResponse> upsertEmbeddings(@RequestBody PostgresEndpoint postgresEndpoint) {

        this.postgresClient.setPostgresEndpoint(postgresEndpoint);
        EdgeChain<StringResponse> edgeChain =
                this.postgresClient.upsert(postgresEndpoint.getWordEmbeddings());

        return edgeChain.toSingle();
    }

    @PostMapping("/query-embeddings")
    public Single<List<PostgresWordEmbeddings>> query(@RequestBody PostgresEndpoint postgresEndpoint) {
        this.postgresClient.setPostgresEndpoint(postgresEndpoint);
        EdgeChain<List<PostgresWordEmbeddings>> edgeChain =
                this.postgresClient.query(
                        postgresEndpoint.getWordEmbeddings(),
                        postgresEndpoint.getMetric(),
                        postgresEndpoint.getTopK(),
                        postgresEndpoint.getProbes());

        return edgeChain.toSingle();
    }

}
