package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.domain.RRFWeight;
import com.edgechain.lib.index.enums.OrderRRFBy;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.enums.PostgresLanguage;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.PostgresService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;

import java.util.List;

public class PostgresEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final PostgresService postgresService = retrofit.create(PostgresService.class);
  private String tableName;
  private int lists;

  private String id;
  private String namespace;

  private String filename;

  // Getters
  private WordEmbeddings wordEmbedding;

  private List<WordEmbeddings> wordEmbeddingsList;

  private PostgresDistanceMetric metric;
  private int dimensions;
  private int topK;

  private int probes;
  private String embeddingChunk;

  // Fields for metadata table
  private List<String> metadataTableNames;
  private String metadata;
  private String metadataId;
  private List<String> metadataList;
  private String documentDate;

  /** RRF * */
  private RRFWeight textWeight;

  private RRFWeight similarityWeight;
  private RRFWeight dateWeight;

  private OrderRRFBy orderRRFBy;
  private String searchQuery;

  private PostgresLanguage postgresLanguage;

  // Join Table
  private List<String> idList;

  public PostgresEndpoint() {}

  public PostgresEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
  }

  public PostgresEndpoint(String tableName) {
    this.tableName = tableName;
  }

  public PostgresEndpoint(String tableName, String namespace) {
    this.tableName = tableName;
    this.namespace = namespace;
  }

  public PostgresEndpoint(String tableName, List<String> metadataTableNames) {
    this.tableName = tableName;
    this.metadataTableNames = metadataTableNames;
  }

  public PostgresEndpoint(String tableName, RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.tableName = tableName;
  }

  public PostgresEndpoint(String tableName, String namespace, RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.tableName = tableName;
    this.namespace = namespace;
  }

  public String getTableName() {
    return tableName;
  }

  public String getNamespace() {
    return namespace;
  }

  public void setTableName(String tableName) {
    this.tableName = tableName;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }

  public void setMetadataTableName(List<String> metadataTableNames) {
    this.metadataTableNames = metadataTableNames;
  }

  public void setMetadata(String metadata) {
    this.metadata = metadata;
  }

  public void setId(String id) {
    this.id = id;
  }

  public void setMetadataId(String metadataId) {
    this.metadataId = metadataId;
  }

  public void setMetadataList(List<String> metadataList) {
    this.metadataList = metadataList;
  }

  public void setEmbeddingChunk(String embeddingChunk) {
    this.embeddingChunk = embeddingChunk;
  }

  // Getters

  public WordEmbeddings getWordEmbedding() {
    return wordEmbedding;
  }

  public int getDimensions() {
    return dimensions;
  }

  public int getTopK() {
    return topK;
  }

  public String getFilename() {
    return filename;
  }

  public List<WordEmbeddings> getWordEmbeddingsList() {
    return wordEmbeddingsList;
  }

  public PostgresDistanceMetric getMetric() {
    return metric;
  }

  public int getLists() {
    return lists;
  }

  public int getProbes() {
    return probes;
  }

  public List<String> getMetadataTableNames() {
    return metadataTableNames;
  }

  public String getMetadata() {
    return metadata;
  }

  public String getMetadataId() {
    return metadataId;
  }

  public String getId() {
    return id;
  }

  public List<String> getMetadataList() {
    return metadataList;
  }

  public String getEmbeddingChunk() {
    return embeddingChunk;
  }

  public String getDocumentDate() {
    return documentDate;
  }

  public RRFWeight getTextWeight() {
    return textWeight;
  }

  public RRFWeight getSimilarityWeight() {
    return similarityWeight;
  }

  public RRFWeight getDateWeight() {
    return dateWeight;
  }

  public OrderRRFBy getOrderRRFBy() {
    return orderRRFBy;
  }

  public String getSearchQuery() {
    return searchQuery;
  }

  public PostgresLanguage getPostgresLanguage() {
    return postgresLanguage;
  }

  public List<String> getIdList() {
    return idList;
  }

  public StringResponse upsert(
      WordEmbeddings wordEmbeddings,
      String filename,
      int dimension,
      PostgresDistanceMetric metric) {
    this.wordEmbedding = wordEmbeddings;
    this.dimensions = dimension;
    this.filename = filename;
    this.metric = metric;
    return this.postgresService.upsert(this).blockingGet();
  }

  public StringResponse createTable(int dimensions, PostgresDistanceMetric metric, int lists) {
    this.dimensions = dimensions;
    this.metric = metric;
    this.lists = lists;
    return this.postgresService.createTable(this).blockingGet();
  }

  public StringResponse createMetadataTable(String metadataTableName) {
    this.metadataTableNames = List.of(metadataTableName);
    return this.postgresService.createMetadataTable(this).blockingGet();
  }

  public List<StringResponse> upsert(
      List<WordEmbeddings> wordEmbeddingsList, String filename, PostgresLanguage postgresLanguage) {
    this.wordEmbeddingsList = wordEmbeddingsList;
    this.filename = filename;
    this.postgresLanguage = postgresLanguage;
    return this.postgresService.batchUpsert(this).blockingGet();
  }

  public StringResponse insertMetadata(
      String metadataTableName, String metadata, String documentDate) {
    this.metadata = metadata;
    this.documentDate = documentDate;
    this.metadataTableNames = List.of(metadataTableName);
    return this.postgresService.insertMetadata(this).blockingGet();
  }

  public List<StringResponse> batchInsertMetadata(List<String> metadataList) {
    this.metadataList = metadataList;
    return this.postgresService.batchInsertMetadata(this).blockingGet();
  }

  public StringResponse insertIntoJoinTable(
      String metadataTableName, String id, String metadataId) {
    this.id = id;
    this.metadataId = metadataId;
    this.metadataTableNames = List.of(metadataTableName);
    return this.postgresService.insertIntoJoinTable(this).blockingGet();
  }

  public StringResponse batchInsertIntoJoinTable(
      String metadataTableName, List<String> idList, String metadataId) {
    this.idList = idList;
    this.metadataId = metadataId;
    this.metadataTableNames = List.of(metadataTableName);
    return this.postgresService.batchInsertIntoJoinTable(this).blockingGet();
  }

  public Observable<List<PostgresWordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {
    this.wordEmbeddingsList = List.of(wordEmbeddings);
    this.topK = topK;
    this.metric = metric;
    this.probes = 1;
    return Observable.fromSingle(this.postgresService.query(this));
  }

  public Observable<List<PostgresWordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK, int probes) {
    this.wordEmbeddingsList = List.of(wordEmbeddings);
    this.topK = topK;
    this.metric = metric;
    this.probes = probes;
    return Observable.fromSingle(this.postgresService.query(this));
  }

  public Observable<List<PostgresWordEmbeddings>> query(
      List<WordEmbeddings> wordEmbeddingsList,
      PostgresDistanceMetric metric,
      int topK,
      int probes) {
    this.wordEmbeddingsList = wordEmbeddingsList;
    this.metric = metric;
    this.probes = probes;
    this.topK = topK;
    return Observable.fromSingle(this.postgresService.query(this));
  }

  public Observable<List<PostgresWordEmbeddings>> queryRRF(
      String metadataTable,
      List<WordEmbeddings> wordEmbeddingsList,
      RRFWeight textWeight,
      RRFWeight similarityWeight,
      RRFWeight dateWeight,
      OrderRRFBy orderRRFBy,
      String searchQuery,
      PostgresLanguage postgresLanguage,
      int probes,
      PostgresDistanceMetric metric,
      int topK) {
    this.metadataTableNames = List.of(metadataTable);
    this.wordEmbeddingsList = wordEmbeddingsList;
    this.textWeight = textWeight;
    this.similarityWeight = similarityWeight;
    this.dateWeight = dateWeight;
    this.orderRRFBy = orderRRFBy;
    this.searchQuery = searchQuery;
    this.postgresLanguage = postgresLanguage;
    this.probes = probes;
    this.metric = metric;
    this.topK = topK;
    return Observable.fromSingle(this.postgresService.queryRRF(this));
  }

  public Observable<List<PostgresWordEmbeddings>> queryWithMetadata(
      List<String> metadataTableNames,
      WordEmbeddings wordEmbeddings,
      PostgresDistanceMetric metric,
      int topK) {
    this.metadataTableNames = metadataTableNames;
    this.wordEmbedding = wordEmbeddings;
    this.topK = topK;
    this.metric = metric;
    this.probes = 1;
    return Observable.fromSingle(this.postgresService.queryWithMetadata(this));
  }

  public Observable<List<PostgresWordEmbeddings>> queryWithMetadata(
      List<String> metadataTableNames,
      WordEmbeddings wordEmbeddings,
      PostgresDistanceMetric metric,
      int topK,
      int probes) {
    this.metadataTableNames = metadataTableNames;
    this.wordEmbedding = wordEmbeddings;
    this.topK = topK;
    this.metric = metric;
    this.probes = probes;
    return Observable.fromSingle(this.postgresService.queryWithMetadata(this));
  }

  public Observable<List<PostgresWordEmbeddings>> getSimilarMetadataChunk(String embeddingChunk) {
    this.embeddingChunk = embeddingChunk;
    return Observable.fromSingle(this.postgresService.getSimilarMetadataChunk(this));
  }

  public Observable<List<PostgresWordEmbeddings>> getAllChunks(String tableName, String filename) {
    this.tableName = tableName;
    this.filename = filename;
    return Observable.fromSingle(this.postgresService.getAllChunks(this));
  }

  public StringResponse deleteAll(String tableName, String namespace) {
    this.tableName = tableName;
    this.namespace = namespace;
    return this.postgresService.deleteAll(this).blockingGet();
  }
}
