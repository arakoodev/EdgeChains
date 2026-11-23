package com.edgechain.lib.retrofit;

import com.edgechain.lib.endpoint.impl.integration.AirtableEndpoint;
import dev.fuxing.airtable.AirtableRecord;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.HTTP;
import retrofit2.http.POST;

import java.util.List;
import java.util.Map;

public interface AirtableService {

  @POST("airtable/findAll")
  Single<Map<String, Object>> findAll(@Body AirtableEndpoint endpoint);

  @POST("airtable/findById")
  Single<AirtableRecord> findById(@Body AirtableEndpoint endpoint);

  @POST("airtable/create")
  Single<List<AirtableRecord>> create(@Body AirtableEndpoint endpoint);

  @POST("airtable/update")
  Single<List<AirtableRecord>> update(@Body AirtableEndpoint endpoint);

  @HTTP(method = "DELETE", path = "airtable/delete", hasBody = true)
  Single<List<String>> delete(@Body AirtableEndpoint endpoint);
}
