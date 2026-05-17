package com.edgechain.lib.integration.airtable.client;

import com.edgechain.lib.endpoint.impl.integration.AirtableEndpoint;
import com.edgechain.lib.integration.airtable.query.AirtableQueryBuilder;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import dev.fuxing.airtable.AirtableApi;
import dev.fuxing.airtable.AirtableRecord;
import dev.fuxing.airtable.AirtableTable;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class AirtableClient {

  public EdgeChain<Map<String, Object>> findAll(AirtableEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                AirtableApi api = new AirtableApi(endpoint.getApiKey());
                AirtableTable table = api.base(endpoint.getBaseId()).table(endpoint.getTableName());

                AirtableQueryBuilder airtableQueryBuilder = endpoint.getAirtableQueryBuilder();

                AirtableTable.PaginationList list =
                    table.list(
                        querySpec -> {
                          int maxRecords = airtableQueryBuilder.getMaxRecords();
                          int pageSize = airtableQueryBuilder.getPageSize();
                          String sortField = airtableQueryBuilder.getSortField();
                          String sortDirection = airtableQueryBuilder.getSortDirection();
                          String offset = airtableQueryBuilder.getOffset();
                          List<String> fields = airtableQueryBuilder.getFields();
                          String filterByFormula = airtableQueryBuilder.getFilterByFormula();
                          String view = airtableQueryBuilder.getView();
                          String cellFormat = airtableQueryBuilder.getCellFormat();
                          String timeZone = airtableQueryBuilder.getTimeZone();
                          String userLocale = airtableQueryBuilder.getUserLocale();

                          querySpec.maxRecords(maxRecords);
                          querySpec.pageSize(pageSize);

                          if (sortField != null && sortDirection != null) {
                            querySpec.sort(sortField, sortDirection);
                          }

                          if (offset != null) {
                            querySpec.offset(offset);
                          }

                          if (fields != null) {
                            querySpec.fields(fields);
                          }

                          if (filterByFormula != null) {
                            querySpec.filterByFormula(filterByFormula);
                          }

                          if (view != null) {
                            querySpec.view(view);
                          }

                          if (cellFormat != null) {
                            querySpec.cellFormat(cellFormat);
                          }

                          if (timeZone != null) {
                            querySpec.timeZone(timeZone);
                          }

                          if (userLocale != null) {
                            querySpec.userLocale(userLocale);
                          }
                        });

                Map<String, Object> mapper = new HashMap<>();
                mapper.put("data", list);
                mapper.put("offset", list.getOffset());

                emitter.onNext(mapper);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  public EdgeChain<AirtableRecord> findById(AirtableEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                AirtableApi api = new AirtableApi(endpoint.getApiKey());
                AirtableTable table = api.base(endpoint.getBaseId()).table(endpoint.getTableName());

                String id = endpoint.getIds().get(0);

                if (Objects.isNull(id) || id.isEmpty())
                  throw new RuntimeException("Id cannot be null");

                AirtableRecord record = table.get(id);

                if (Objects.isNull(record))
                  throw new RuntimeException("Id: " + id + " does not exist");

                emitter.onNext(record);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  public EdgeChain<List<AirtableRecord>> create(AirtableEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                AirtableApi api = new AirtableApi(endpoint.getApiKey());
                AirtableTable table = api.base(endpoint.getBaseId()).table(endpoint.getTableName());

                List<AirtableRecord> airtableRecordList =
                    table.post(endpoint.getAirtableRecordList(), endpoint.isTypecast());

                emitter.onNext(airtableRecordList);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  public EdgeChain<List<AirtableRecord>> update(AirtableEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                AirtableApi api = new AirtableApi(endpoint.getApiKey());
                AirtableTable table = api.base(endpoint.getBaseId()).table(endpoint.getTableName());

                List<AirtableRecord> airtableRecordList =
                    table.put(endpoint.getAirtableRecordList(), endpoint.isTypecast());

                emitter.onNext(airtableRecordList);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  public EdgeChain<List<String>> delete(AirtableEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                AirtableApi api = new AirtableApi(endpoint.getApiKey());
                AirtableTable table = api.base(endpoint.getBaseId()).table(endpoint.getTableName());

                List<String> deleteIdsList = table.delete(endpoint.getIds());

                emitter.onNext(deleteIdsList);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }
}
