package com.edgechain;

import com.edgechain.lib.endpoint.impl.integration.AirtableEndpoint;
import com.edgechain.lib.integration.airtable.query.AirtableQueryBuilder;
import com.edgechain.lib.integration.airtable.query.SortOrder;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import dev.fuxing.airtable.AirtableRecord;
import dev.fuxing.airtable.formula.AirtableFormula;
import dev.fuxing.airtable.formula.LogicalOperator;
import org.json.JSONObject;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.web.bind.annotation.*;

import java.util.Properties;

/**
 * For the purpose, of this example, create a simple table using AirTable i.e, "Speakers" Following
 * are some basic fields: "speaker_name", "designation", "organization", "biography",
 * "speaker_photo", "rating To get, your BASE_ID of specific database; use the following API
 * https://api.airtable.com/v0/meta/bases --header 'Authorization: Bearer
 * YOUR_PERSONAL_ACCESS_TOKEN' You can create, complex tables using Airtable; also define
 * relationships b/w tables via lookups.
 */
@SpringBootApplication
public class AirtableExample {
  private static final String AIRTABLE_API_KEY = "";
  private static final String AIRTABLE_BASE_ID = "";

  private static AirtableEndpoint airtableEndpoint;

  public static void main(String[] args) {

    System.setProperty("server.port", "8080");

    Properties properties = new Properties();
    properties.setProperty("cors.origins", "http://localhost:4200");

    new SpringApplicationBuilder(AirtableExample.class).properties(properties).run(args);

    airtableEndpoint = new AirtableEndpoint(AIRTABLE_BASE_ID, AIRTABLE_API_KEY);
  }

  @RestController
  @RequestMapping("/airtable")
  public class AirtableController {

    @GetMapping("/findAll")
    public ArkResponse findAll(ArkRequest arkRequest) {

      int pageSize = arkRequest.getIntQueryParam("pageSize");
      String sortSpeakerName = arkRequest.getQueryParam("sortName");
      String offset = arkRequest.getQueryParam("offset");

      AirtableQueryBuilder queryBuilder = new AirtableQueryBuilder();
      queryBuilder.pageSize(pageSize); // pageSize --> no. of records in each request
      queryBuilder.sort("speaker_name", SortOrder.fromValue(sortSpeakerName).getValue());
      queryBuilder.offset(offset); // move to next page by passing offset returned in response;

      // Return only those speakers which have rating Greater Than Eq to 3;
      queryBuilder.filterByFormula(
          LogicalOperator.GTE,
          AirtableFormula.Object.field("rating"),
          AirtableFormula.Object.value(3));

      return new EdgeChain<>(airtableEndpoint.findAll("Speakers", queryBuilder)).getArkResponse();
    }

    @GetMapping("/find")
    public ArkResponse findById(ArkRequest arkRequest) {
      String id = arkRequest.getQueryParam("id");
      return new EdgeChain<>(airtableEndpoint.findById("Speakers", id)).getArkResponse();
    }

    @PostMapping("/create")
    public ArkResponse create(ArkRequest arkRequest) {

      JSONObject body = arkRequest.getBody();
      String speakerName = body.getString("name");
      String designation = body.getString("designation");
      int rating = body.getInt("rating");
      String organization = body.getString("organization");
      String biography = body.getString("biography");

      // Airtable API doesn't allow to upload blob files directly; therefore, you would require to
      // upload it
      // to some cloud storage i.e, S3 and then set the URL in Airtable.

      AirtableRecord record = new AirtableRecord();
      record.putField("speaker_name", speakerName);
      record.putField("designation", designation);
      record.putField("rating", rating);
      record.putField("organization", organization);
      record.putField("biography", biography);

      return new EdgeChain<>(airtableEndpoint.create("Speakers", record)).getArkResponse();
    }

    @PostMapping("/update")
    public ArkResponse update(ArkRequest arkRequest) {

      JSONObject body = arkRequest.getBody();
      String id = body.getString("id");
      String speakerName = body.getString("name");
      String designation = body.getString("designation");
      int rating = body.getInt("rating");
      String organization = body.getString("organization");
      String biography = body.getString("biography");

      // Airtable API doesn't allow to upload blob files directly; therefore, you would require to
      // upload it
      // to some cloud storage i.e, S3 and then set the URL in Airtable.

      AirtableRecord record = new AirtableRecord();
      record.setId(id);
      record.putField("speaker_name", speakerName);
      record.putField("designation", designation);
      record.putField("rating", rating);
      record.putField("organization", organization);
      record.putField("biography", biography);

      return new EdgeChain<>(airtableEndpoint.update("Speakers", record)).getArkResponse();
    }

    @DeleteMapping("/delete")
    public ArkResponse delete(ArkRequest arkRequest) {
      JSONObject body = arkRequest.getBody();
      String id = body.getString("id");
      return new EdgeChain<>(airtableEndpoint.delete("Speakers", id)).getArkResponse();
    }
  }
}
