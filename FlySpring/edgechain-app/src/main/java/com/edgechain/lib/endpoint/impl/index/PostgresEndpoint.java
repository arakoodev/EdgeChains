package com.edgechain.lib.endpoint.impl.index;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.endpoint.impl.embeddings.EmbeddingEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.domain.RRFWeight;
import com.edgechain.lib.index.enums.OrderRRFBy;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.enums.PostgresLanguage;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.PostgresService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

import java.util.List;

public class PostgresEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final PostgresService postgresService = retrofit.create(PostgresService.class);
  private ModelMapper modelMapper = new ModelMapper();
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
  private int upperLimit;

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

  private EmbeddingEndpoint embeddingEndpoint;

  public PostgresEndpoint() {}

  public PostgresEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
  }

  public PostgresEndpoint(String tableName, EmbeddingEndpoint embeddingEndpoint) {
    this.tableName = tableName;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public PostgresEndpoint(String tableName, String namespace, EmbeddingEndpoint embeddingEndpoint) {
    this.tableName = tableName;
    this.namespace = namespace;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public PostgresEndpoint(
      String tableName, EmbeddingEndpoint embeddingEndpoint, RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.tableName = tableName;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public PostgresEndpoint(
      String tableName,
      String namespace,
      EmbeddingEndpoint embeddingEndpoint,
      RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.tableName = tableName;
    this.namespace = namespace;
    this.embeddingEndpoint = embeddingEndpoint;
  }

  public String getTableName() {
    return tableName;
  }

  public String getNamespace() {
    return namespace;
  }

  public EmbeddingEndpoint getEmbeddingEndpoint() {
    return embeddingEndpoint;
  }

  public void setTableName(String tableName) {
    this.tableName = tableName;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
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

  public int getUpperLimit() {
    return upperLimit;
  }

  public void setUpperLimit(int upperLimit) {
    this.upperLimit = upperLimit;
  }

  private void setLists(int lists) {
    this.lists = lists;
  }

  private void setFilename(String filename) {
    this.filename = filename;
  }

  private void setWordEmbedding(WordEmbeddings wordEmbedding) {
    this.wordEmbedding = wordEmbedding;
  }

  private void setWordEmbeddingsList(List<WordEmbeddings> wordEmbeddingsList) {
    this.wordEmbeddingsList = wordEmbeddingsList;
  }

  private void setMetric(PostgresDistanceMetric metric) {
    this.metric = metric;
  }

  private void setDimensions(int dimensions) {
    this.dimensions = dimensions;
  }

  private void setTopK(int topK) {
    this.topK = topK;
  }

  private void setProbes(int probes) {
    this.probes = probes;
  }

  private void setMetadataTableNames(List<String> metadataTableNames) {
    this.metadataTableNames = metadataTableNames;
  }

  private void setDocumentDate(String documentDate) {
    this.documentDate = documentDate;
  }

  private void setTextWeight(RRFWeight textWeight) {
    this.textWeight = textWeight;
  }

  private void setSimilarityWeight(RRFWeight similarityWeight) {
    this.similarityWeight = similarityWeight;
  }

  private void setDateWeight(RRFWeight dateWeight) {
    this.dateWeight = dateWeight;
  }

  private void setOrderRRFBy(OrderRRFBy orderRRFBy) {
    this.orderRRFBy = orderRRFBy;
  }

  private void setSearchQuery(String searchQuery) {
    this.searchQuery = searchQuery;
  }

  private void setPostgresLanguage(PostgresLanguage postgresLanguage) {
    this.postgresLanguage = postgresLanguage;
  }

  private void setIdList(List<String> idList) {
    this.idList = idList;
  }

  public void setEmbeddingEndpoint(EmbeddingEndpoint embeddingEndpoint) {
    this.embeddingEndpoint = embeddingEndpoint;
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

    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setWordEmbedding(wordEmbeddings);
    mapper.setFilename(filename);
    mapper.setDimensions(dimension);
    mapper.setMetric(metric);
    return this.postgresService.upsert(mapper).blockingGet();
  }

  public StringResponse createTable(int dimensions, PostgresDistanceMetric metric, int lists) {

    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setDimensions(dimensions);
    mapper.setMetric(metric);
    mapper.setLists(lists);

    return this.postgresService.createTable(mapper).blockingGet();
  }

  public StringResponse createMetadataTable(String metadataTableName) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setMetadataTableNames(List.of(metadataTableName));
    return this.postgresService.createMetadataTable(mapper).blockingGet();
  }

  public List<StringResponse> upsert(
      List<WordEmbeddings> wordEmbeddingsList, String filename, PostgresLanguage postgresLanguage) {

    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setWordEmbeddingsList(wordEmbeddingsList);
    mapper.setFilename(filename);
    mapper.setPostgresLanguage(postgresLanguage);

    return this.postgresService.batchUpsert(mapper).blockingGet();
  }

  public StringResponse insertMetadata(
      String metadataTableName, String metadata, String documentDate) {

    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setMetadata(metadata);
    mapper.setDocumentDate(documentDate);
    mapper.setMetadataTableNames(List.of(metadataTableName));
    return this.postgresService.insertMetadata(mapper).blockingGet();
  }

  public List<StringResponse> batchInsertMetadata(List<String> metadataList) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setMetadataList(metadataList);
    return this.postgresService.batchInsertMetadata(mapper).blockingGet();
  }

  public StringResponse insertIntoJoinTable(
      String metadataTableName, String id, String metadataId) {

    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setId(id);
    mapper.setMetadataId(metadataId);
    mapper.setMetadataTableNames(List.of(metadataTableName));

    return this.postgresService.insertIntoJoinTable(mapper).blockingGet();
  }

  public StringResponse batchInsertIntoJoinTable(
      String metadataTableName, List<String> idList, String metadataId) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setIdList(idList);
    mapper.setMetadataId(metadataId);
    mapper.setMetadataTableNames(List.of(metadataTableName));
    return this.postgresService.batchInsertIntoJoinTable(mapper).blockingGet();
  }

  public Observable<List<PostgresWordEmbeddings>> query(
      List<String> inputList,
      PostgresDistanceMetric metric,
      int topK,
      int upperLimit,
      ArkRequest arkRequest) {

    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);

    List<WordEmbeddings> endpointEmbeddingList =
        Observable.fromIterable(inputList)
            .buffer(inputList.size() > 1 ? inputList.size() / 2 : 1)
            .flatMap(
                bufferedList ->
                    Observable.fromIterable(bufferedList)
                        .flatMap(
                            res ->
                                Observable.fromCallable(
                                        () ->
                                            new EdgeChain<>(
                                                    embeddingEndpoint.embeddings(res, arkRequest))
                                                .get())
                                    .subscribeOn(Schedulers.io())))
            .toList()
            .blockingGet();

    mapper.setWordEmbeddingsList(endpointEmbeddingList);
    mapper.setTopK(topK);
    mapper.setUpperLimit(upperLimit);
    mapper.setMetric(metric);
    mapper.setProbes(1);
    return Observable.fromSingle(this.postgresService.query(mapper));
  }

  public Observable<List<PostgresWordEmbeddings>> query(
      List<String> inputList,
      PostgresDistanceMetric metric,
      int topK,
      int upperLimit,
      int probes,
      ArkRequest arkRequest) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);

    List<WordEmbeddings> endpointEmbeddingList =
        Observable.fromIterable(inputList)
            .buffer(inputList.size() > 1 ? inputList.size() / 2 : 1)
            .flatMap(
                bufferedList ->
                    Observable.fromIterable(bufferedList)
                        .flatMap(
                            res ->
                                Observable.fromCallable(
                                        () ->
                                            new EdgeChain<>(
                                                    embeddingEndpoint.embeddings(res, arkRequest))
                                                .get())
                                    .subscribeOn(Schedulers.io())))
            .toList()
            .blockingGet();

    mapper.setWordEmbeddingsList(endpointEmbeddingList);
    mapper.setMetric(metric);
    mapper.setProbes(probes);
    mapper.setTopK(topK);
    mapper.setUpperLimit(upperLimit);
    return Observable.fromSingle(this.postgresService.query(mapper));
  }

  public Observable<List<PostgresWordEmbeddings>> queryRRF(
      String metadataTable,
      List<String> inputList,
      RRFWeight textWeight,
      RRFWeight similarityWeight,
      RRFWeight dateWeight,
      OrderRRFBy orderRRFBy,
      String searchQuery,
      PostgresLanguage postgresLanguage,
      int probes,
      PostgresDistanceMetric metric,
      int topK,
      int upperLimit,
      ArkRequest arkRequest) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setMetadataTableNames(List.of(metadataTable));

    List<WordEmbeddings> endpointEmbeddingList =
        Observable.fromIterable(inputList)
            .buffer(inputList.size() > 1 ? inputList.size() / 2 : 1)
            .flatMap(
                bufferedList ->
                    Observable.fromIterable(bufferedList)
                        .flatMap(
                            res ->
                                Observable.fromCallable(
                                        () ->
                                            new EdgeChain<>(
                                                    embeddingEndpoint.embeddings(res, arkRequest))
                                                .get())
                                    .subscribeOn(Schedulers.io())))
            .toList()
            .blockingGet();

    mapper.setWordEmbeddingsList(endpointEmbeddingList);
    mapper.setTextWeight(textWeight);
    mapper.setSimilarityWeight(similarityWeight);
    mapper.setDateWeight(dateWeight);
    mapper.setOrderRRFBy(orderRRFBy);
    mapper.setSearchQuery(searchQuery);
    mapper.setPostgresLanguage(postgresLanguage);
    mapper.setProbes(probes);
    mapper.setMetric(metric);
    mapper.setTopK(topK);
    mapper.setUpperLimit(upperLimit);
    return Observable.fromSingle(this.postgresService.queryRRF(mapper));
  }

  public Observable<List<PostgresWordEmbeddings>> queryWithMetadata(
      List<String> metadataTableNames,
      WordEmbeddings wordEmbeddings,
      PostgresDistanceMetric metric,
      int topK) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setMetadataTableNames(metadataTableNames);
    mapper.setWordEmbedding(wordEmbeddings);
    mapper.setTopK(topK);
    mapper.setMetric(metric);
    mapper.setProbes(1);
    return Observable.fromSingle(this.postgresService.queryWithMetadata(mapper));
  }

  public Observable<List<PostgresWordEmbeddings>> queryWithMetadata(
      List<String> metadataTableNames,
      String input,
      PostgresDistanceMetric metric,
      int topK,
      ArkRequest arkRequest) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);

    WordEmbeddings wordEmbeddings =
        new EdgeChain<>(embeddingEndpoint.embeddings(input, arkRequest)).get();

    mapper.setMetadataTableNames(metadataTableNames);
    mapper.setWordEmbedding(wordEmbeddings);
    mapper.setTopK(topK);
    mapper.setMetric(metric);
    mapper.setProbes(1);
    return Observable.fromSingle(this.postgresService.queryWithMetadata(mapper));
  }

  public Observable<List<PostgresWordEmbeddings>> getSimilarMetadataChunk(String embeddingChunk) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setEmbeddingChunk(embeddingChunk);
    return Observable.fromSingle(this.postgresService.getSimilarMetadataChunk(mapper));
  }

  public Observable<List<PostgresWordEmbeddings>> getAllChunks(String tableName, String filename) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setTableName(tableName);
    mapper.setFilename(filename);

    return Observable.fromSingle(this.postgresService.getAllChunks(this));
  }

  public StringResponse deleteAll(String tableName, String namespace) {
    PostgresEndpoint mapper = modelMapper.map(this, PostgresEndpoint.class);
    mapper.setTableName(tableName);
    mapper.setNamespace(namespace);
    return this.postgresService.deleteAll(mapper).blockingGet();
  }
}
