package com.edgechain.lib.endpoint.impl.integration;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.integration.airtable.query.AirtableQueryBuilder;
import com.edgechain.lib.retrofit.AirtableService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import dev.fuxing.airtable.AirtableRecord;
import io.reactivex.rxjava3.core.Observable;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

import java.util.List;
import java.util.Map;

public class AirtableEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final AirtableService airtableService = retrofit.create(AirtableService.class);

  private ModelMapper modelMapper = new ModelMapper();

  private String baseId;
  private String apiKey;

  private List<String> ids;
  private String tableName;
  private List<AirtableRecord> airtableRecordList;
  private boolean typecast = false;

  private AirtableQueryBuilder airtableQueryBuilder;

  public AirtableEndpoint() {}

  public AirtableEndpoint(String baseId, String apiKey) {
    this.baseId = baseId;
    this.apiKey = apiKey;
  }

  public void setIds(List<String> ids) {
    this.ids = ids;
  }

  public void setTableName(String tableName) {
    this.tableName = tableName;
  }

  public void setAirtableRecordList(List<AirtableRecord> airtableRecordList) {
    this.airtableRecordList = airtableRecordList;
  }

  public void setTypecast(boolean typecast) {
    this.typecast = typecast;
  }

  public void setAirtableQueryBuilder(AirtableQueryBuilder airtableQueryBuilder) {
    this.airtableQueryBuilder = airtableQueryBuilder;
  }

  public void setBaseId(String baseId) {
    this.baseId = baseId;
  }

  @Override
  public void setApiKey(String apiKey) {
    this.apiKey = apiKey;
  }

  public String getBaseId() {
    return baseId;
  }

  public String getApiKey() {
    return apiKey;
  }

  public String getTableName() {
    return tableName;
  }

  public List<String> getIds() {
    return ids;
  }

  public List<AirtableRecord> getAirtableRecordList() {
    return airtableRecordList;
  }

  public boolean isTypecast() {
    return typecast;
  }

  public AirtableQueryBuilder getAirtableQueryBuilder() {
    return airtableQueryBuilder;
  }

  public Observable<Map<String, Object>> findAll(String tableName, AirtableQueryBuilder builder) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    ;
    mapper.setTableName(tableName);
    mapper.setAirtableQueryBuilder(builder);
    return Observable.fromSingle(this.airtableService.findAll(mapper));
  }

  public Observable<Map<String, Object>> findAll(String tableName) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setTableName(tableName);
    mapper.setAirtableQueryBuilder(new AirtableQueryBuilder());

    return Observable.fromSingle(this.airtableService.findAll(mapper));
  }

  public Observable<AirtableRecord> findById(String tableName, String id) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setTableName(tableName);
    mapper.setIds(List.of(id));
    return Observable.fromSingle(this.airtableService.findById(mapper));
  }

  public Observable<List<AirtableRecord>> create(
      String tableName, List<AirtableRecord> airtableRecordList) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setAirtableRecordList(airtableRecordList);
    mapper.setTableName(tableName);
    return Observable.fromSingle(this.airtableService.create(mapper));
  }

  public Observable<List<AirtableRecord>> create(
      String tableName, List<AirtableRecord> airtableRecordList, boolean typecast) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setAirtableRecordList(airtableRecordList);
    mapper.setTableName(tableName);
    mapper.setTypecast(typecast);
    return Observable.fromSingle(this.airtableService.create(mapper));
  }

  public Observable<List<AirtableRecord>> create(String tableName, AirtableRecord airtableRecord) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setAirtableRecordList(List.of(airtableRecord));
    mapper.setTableName(tableName);
    return Observable.fromSingle(this.airtableService.create(mapper));
  }

  public Observable<List<AirtableRecord>> update(
      String tableName, List<AirtableRecord> airtableRecordList) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setAirtableRecordList(airtableRecordList);
    mapper.setTableName(tableName);

    return Observable.fromSingle(this.airtableService.update(mapper));
  }

  public Observable<List<AirtableRecord>> update(
      String tableName, List<AirtableRecord> airtableRecordList, boolean typecast) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setAirtableRecordList(airtableRecordList);
    mapper.setTableName(tableName);
    mapper.setTypecast(typecast);

    return Observable.fromSingle(this.airtableService.update(mapper));
  }

  public Observable<List<AirtableRecord>> update(String tableName, AirtableRecord airtableRecord) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setAirtableRecordList(List.of(airtableRecord));
    mapper.setTableName(tableName);
    return Observable.fromSingle(this.airtableService.update(mapper));
  }

  public Observable<List<String>> delete(String tableName, List<String> ids) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setIds(ids);
    mapper.setTableName(tableName);
    return Observable.fromSingle(this.airtableService.delete(mapper));
  }

  public Observable<List<String>> delete(String tableName, String id) {
    AirtableEndpoint mapper = modelMapper.map(this, AirtableEndpoint.class);
    mapper.setIds(List.of(id));
    mapper.setTableName(tableName);
    return Observable.fromSingle(this.airtableService.delete(mapper));
  }
}
