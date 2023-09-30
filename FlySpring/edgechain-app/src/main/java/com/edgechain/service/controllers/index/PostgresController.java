package com.edgechain.service.controllers.index;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.endpoint.impl.index.PostgresEndpoint;
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

  @PostMapping("/create-table")
  public Single<StringResponse> createTable(@RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.createTable(postgresEndpoint).toSingle();
  }

  @PostMapping("/metadata/create-table")
  public Single<StringResponse> createMetadataTable(
      @RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.createMetadataTable(postgresEndpoint).toSingle();
  }

  @PostMapping("/upsert")
  public Single<StringResponse> upsert(@RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.upsert(postgresEndpoint).toSingle();
  }

  @PostMapping("/batch-upsert")
  public Single<List<StringResponse>> batchUpsert(@RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.batchUpsert(postgresEndpoint).toSingleWithoutScheduler();
  }

  @PostMapping("/metadata/insert")
  public Single<StringResponse> insertMetadata(@RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.insertMetadata(postgresEndpoint).toSingle();
  }

  @PostMapping("/metadata/batch-insert")
  public Single<List<StringResponse>> batchInsertMetadata(
      @RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.batchInsertMetadata(postgresEndpoint).toSingle();
  }

  @PostMapping("/join/insert")
  public Single<StringResponse> insertIntoJoinTable(
      @RequestBody PostgresEndpoint postgresEndpoint) {
    EdgeChain<StringResponse> edgeChain = this.postgresClient.insertIntoJoinTable(postgresEndpoint);
    return edgeChain.toSingle();
  }

  @PostMapping("/join/batch-insert")
  public Single<StringResponse> batchInsertIntoJoinTable(
      @RequestBody PostgresEndpoint postgresEndpoint) {
    EdgeChain<StringResponse> edgeChain =
        this.postgresClient.batchInsertIntoJoinTable(postgresEndpoint);
    return edgeChain.toSingle();
  }

  @PostMapping("/query")
  public Single<List<PostgresWordEmbeddings>> query(
      @RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.query(postgresEndpoint).toSingle();
  }

  @PostMapping("/query-rrf")
  public Single<List<PostgresWordEmbeddings>> queryRRF(
      @RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.queryRRF(postgresEndpoint).toSingle();
  }

  @PostMapping("/metadata/query")
  public Single<List<PostgresWordEmbeddings>> queryWithMetadata(
      @RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.queryWithMetadata(postgresEndpoint).toSingle();
  }

  @PostMapping("/chunks")
  public Single<List<PostgresWordEmbeddings>> getAllChunks(
      @RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.getAllChunks(postgresEndpoint).toSingle();
  }

  @PostMapping("/similarity-metadata")
  public Single<List<PostgresWordEmbeddings>> getSimilarMetadataChunk(
      @RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.getSimilarMetadataChunk(postgresEndpoint).toSingle();
  }

  @DeleteMapping("/deleteAll")
  public Single<StringResponse> deleteAll(@RequestBody PostgresEndpoint postgresEndpoint) {
    return this.postgresClient.deleteAll(postgresEndpoint).toSingle();
  }
}
