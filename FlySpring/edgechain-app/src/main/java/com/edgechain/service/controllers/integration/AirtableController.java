package com.edgechain.service.controllers.integration;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.endpoint.impl.integration.AirtableEndpoint;
import com.edgechain.lib.integration.airtable.client.AirtableClient;
import dev.fuxing.airtable.AirtableRecord;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController("Service AirtableController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/airtable")
public class AirtableController {

  @Autowired private AirtableClient airtableClient;

  @PostMapping("/findAll")
  public Single<Map<String, Object>> findAll(@RequestBody AirtableEndpoint endpoint) {
    return airtableClient.findAll(endpoint).toSingleWithoutScheduler();
  }

  @PostMapping("/findById")
  public Single<AirtableRecord> findById(@RequestBody AirtableEndpoint endpoint) {
    return airtableClient.findById(endpoint).toSingleWithoutScheduler();
  }

  @PostMapping("/create")
  public Single<List<AirtableRecord>> create(@RequestBody AirtableEndpoint endpoint) {
    return airtableClient.create(endpoint).toSingleWithoutScheduler();
  }

  @PostMapping("/update")
  public Single<List<AirtableRecord>> update(@RequestBody AirtableEndpoint endpoint) {
    return airtableClient.update(endpoint).toSingleWithoutScheduler();
  }

  @DeleteMapping("/delete")
  public Single<List<String>> delete(@RequestBody AirtableEndpoint endpoint) {
    return airtableClient.delete(endpoint).toSingleWithoutScheduler();
  }
}
