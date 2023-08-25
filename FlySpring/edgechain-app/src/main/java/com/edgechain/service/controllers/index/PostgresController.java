package com.edgechain.service.controllers.index;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.client.impl.PostgresClient;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Single;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.web.bind.annotation.*;

@RestController("Service PostgresController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/index/postgres")
public class PostgresController {

  @Autowired @Lazy private PostgresClient postgresClient;

  @PostMapping("/upsert")
  public Single<Integer> upsert(@RequestBody PostgresEndpoint postgresEndpoint) {

    this.postgresClient.setPostgresEndpoint(postgresEndpoint);
    EdgeChain<Integer> edgeChain =
        this.postgresClient.upsert(postgresEndpoint.getWordEmbeddings());

    return edgeChain.toSingle();
  }

  @PostMapping("/metadata/insert")
  public Single<Integer> insertMetadata(@RequestBody PostgresEndpoint postgresEndpoint) {
    this.postgresClient.setPostgresEndpoint(postgresEndpoint);
    EdgeChain<Integer> edgeChain =
            this.postgresClient.insertMetadata(postgresEndpoint.getWordEmbeddings());
    return edgeChain.toSingle();
  }

  @PostMapping("/join/insert")
  public Single<StringResponse> insertIntoJoinTable(@RequestBody PostgresEndpoint postgresEndpoint) {
    this.postgresClient.setPostgresEndpoint(postgresEndpoint);
    EdgeChain<StringResponse> edgeChain = this.postgresClient.insertIntoJoinTable(postgresEndpoint);
    return edgeChain.toSingle();
  }

  @PostMapping("/query")
  public Single<List<PostgresWordEmbeddings>> query(
      @RequestBody PostgresEndpoint postgresEndpoint) {

    this.postgresClient.setPostgresEndpoint(postgresEndpoint);

    EdgeChain<List<PostgresWordEmbeddings>> edgeChain =
        this.postgresClient.query(
            postgresEndpoint.getWordEmbeddings(),
            postgresEndpoint.getMetric(),
            postgresEndpoint.getTopK(),
            postgresEndpoint.getProbes());

    return edgeChain.toSingle();
  }
  @PostMapping("/chunks")
  public Single<List<PostgresWordEmbeddings>> getAllChunks(
      @RequestBody PostgresEndpoint postgresEndpoint) {

    this.postgresClient.setPostgresEndpoint(postgresEndpoint);

    EdgeChain<List<PostgresWordEmbeddings>> edgeChain = this.postgresClient.getAllChunks(postgresEndpoint);
    return edgeChain.toSingle();
  }

  @PostMapping("/similarity-metadata")
  public Single<List<PostgresWordEmbeddings>> similaritySearchMetadata(
          @RequestBody PostgresEndpoint postgresEndpoint
  ) {
    this.postgresClient.setPostgresEndpoint(postgresEndpoint);
    EdgeChain<List<PostgresWordEmbeddings>> edgeChain = this.postgresClient.similaritySearchMetadata(postgresEndpoint.getWordEmbeddings(), postgresEndpoint.getMetric(), postgresEndpoint.getTopK());
    return edgeChain.toSingle();
  }

  @DeleteMapping("/deleteAll")
  public Single<StringResponse> deleteAll(@RequestBody PostgresEndpoint postgresEndpoint) {

    this.postgresClient.setPostgresEndpoint(postgresEndpoint);

    EdgeChain<StringResponse> edgeChain = this.postgresClient.deleteAll();
    return edgeChain.toSingle();
  }
}
