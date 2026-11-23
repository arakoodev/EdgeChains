package com.edgechain;

// DEPS com.amazonaws:aws-java-sdk-s3:1.12.554

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.model.ListObjectsV2Request;
import com.amazonaws.services.s3.model.ListObjectsV2Result;
import com.amazonaws.services.s3.model.S3Object;
import com.amazonaws.services.s3.model.S3ObjectSummary;
import com.edgechain.lib.chains.PineconeRetrieval;
import com.edgechain.lib.chunk.Chunker;
import com.edgechain.lib.endpoint.impl.embeddings.OpenAiEmbeddingEndpoint;
import com.edgechain.lib.endpoint.impl.index.PineconeEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import me.xuender.unidecode.Unidecode;
import org.apache.commons.io.IOUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.util.retry.Retry;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_EMBEDDINGS_API;

/**
 * Objective (1): 1. Use Zapier Webhook to pass list of urls (in our example, we have used Wikipedia
 * Urls") ==> Trigger 2. Action: Use 'Web Page Parser by Zapier' to extract entire content (which is
 * later used to upsert in Pinecone) from url 3. Action: Stringify the JSON 4. Action: Save each
 * json (parsed content from each URL) to Amazon S3 (This process is entirely automated by Zapier).
 * You would need to create Zap for it. Zapier Hook is used to trigger the ETL process, (Parallelize
 * Hook Requests)... ========================================================== 5. Then, we extract
 * each file from Amazon S3 6. Upsert the normalized content to Pinecone with a chunkSize of 512...
 * You can choose any file storage S3, Dropbox, Google Drive etc....
 */

/**
 * Objective (2): Extracting PDF via PDF4Me. Create a Zapier by using the following steps: 1.
 * Trigger ==> Integrate Google Drive Folder; when new file is added (it's not instant; it's
 * scheduled internally by Zapier.) (You can also trigger it by Webhook as well) 2. Action ==>
 * Extract text from PDF using PDF4Me (Free plan allows 20 API calls) 3. Action ==> Use ZapierByCode
 * to stringify the json response from PDF4Me 4. Action ==> Save it to Amazon S3 Now, from
 * EdgeChains SDK we extract the files from S3 & upsert it to Pinecone via Chunk Size 512.
 */
@SpringBootApplication
public class ZapierExample {

  private static final String OPENAI_AUTH_KEY = ""; // YOUR OPENAI AUTH KEY
  private static final String OPENAI_ORG_ID = ""; // YOUR OPENAI ORG ID
  private static final String ZAPIER_HOOK_URL =
      ""; // E.g. https://hooks.zapier.com/hooks/catch/18785910/2ia657b

  private static final String PINECONE_AUTH_KEY = "";
  private static final String PINECONE_API = "";

  private static PineconeEndpoint pineconeEndpoint;

  public static void main(String[] args) {

    System.setProperty("server.port", "8080");

    new SpringApplicationBuilder(ZapierExample.class).run(args);

    OpenAiEmbeddingEndpoint adaEmbedding =
        new OpenAiEmbeddingEndpoint(
            OPENAI_EMBEDDINGS_API,
            OPENAI_AUTH_KEY,
            OPENAI_ORG_ID,
            "text-embedding-ada-002",
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));

    pineconeEndpoint =
        new PineconeEndpoint(
            PINECONE_API,
            PINECONE_AUTH_KEY,
            adaEmbedding,
            new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));
  }

  @Bean
  public AmazonS3 s3Client() {

    String accessKey = ""; // YOUR_AWS_S3_ACCESS_KEY
    String secretKey = ""; // YOUR_AWS_S3_SECRET_KEY

    BasicAWSCredentials awsCredentials = new BasicAWSCredentials(accessKey, secretKey);
    return AmazonS3ClientBuilder.standard()
        .withRegion(Regions.fromName("us-east-1"))
        .withCredentials(new AWSStaticCredentialsProvider(awsCredentials))
        .build();
  }

  @RestController
  public class ZapierController {

    @Autowired private AmazonS3 s3Client;

    // List of wiki urls triggered in parallel via WebHook. They are automatically parsed,
    // transformed to JSON and stored in AWS S3.
    /*
     Examples:
                "https://en.wikipedia.org/wiki/The_Weather_Company",
               "https://en.wikipedia.org/wiki/Microsoft_Bing",
               "https://en.wikipedia.org/wiki/Quora",
               "https://en.wikipedia.org/wiki/Steve_Jobs",
               "https://en.wikipedia.org/wiki/Michael_Jordan",
    */
    @PostMapping("/etl")
    public void performETL(ArkRequest arkRequest) {

      JSONObject body = arkRequest.getBody();
      JSONArray jsonArray = body.getJSONArray("urls");

      IntStream.range(0, jsonArray.length())
          .parallel()
          .forEach(
              index -> {
                String url = jsonArray.getString(index);
                // For Logging
                System.out.printf("Url %s: %s\n", index, url);

                // Trigger Zapier WebHook
                this.zapWebHook(url);
              });
    }

    @PostMapping("/upsert-urls")
    public void upsertParsedURLs(ArkRequest arkRequest) throws IOException {
      String namespace = arkRequest.getQueryParam("namespace");
      JSONObject body = arkRequest.getBody();
      String bucketName = body.getString("bucketName");

      // Get all the files from S3 bucket
      ListObjectsV2Request listObjectsRequest =
          new ListObjectsV2Request().withBucketName(bucketName);

      ListObjectsV2Result objectListing = s3Client.listObjectsV2(listObjectsRequest);

      for (S3ObjectSummary objectSummary : objectListing.getObjectSummaries()) {
        String key = objectSummary.getKey();

        if (key.endsWith(".txt")) {

          S3Object object = s3Client.getObject(bucketName, key);
          InputStream objectData = object.getObjectContent();
          String content = IOUtils.toString(objectData, StandardCharsets.UTF_8);

          JSONObject jsonObject = new JSONObject(content);

          // These fields are specified from Zapier Action...
          System.out.println("Domain: " + jsonObject.getString("domain")); // en.wikipedia.org
          System.out.println("Title: " + jsonObject.getString("title")); // Barack Obama
          System.out.println("Author: " + jsonObject.getString("author")); // Wikipedia Contributers
          System.out.println("Word Count: " + jsonObject.get("word_count")); // 23077
          System.out.println(
              "Date Published: " + jsonObject.getString("date_published")); // Publish date

          // Now, we extract content and Chunk it by 512 size; then upsert it to Pinecone
          // Normalize the extracted content....

          String normalizedText =
              Unidecode.decode(jsonObject.getString("content")).replaceAll("[\t\n\r]+", " ");
          Chunker chunker = new Chunker(normalizedText);
          String[] arr = chunker.byChunkSize(512);

          // Upsert to Pinecone:
          PineconeRetrieval retrieval =
              new PineconeRetrieval(arr, pineconeEndpoint, namespace, arkRequest);

          retrieval.upsert();

          System.out.println("File is parsed: " + key); // For Logging
        }
      }
    }

    @PostMapping("/upsert-pdfs")
    public void upsertPDFs(ArkRequest arkRequest) throws IOException {
      String namespace = arkRequest.getQueryParam("namespace");
      JSONObject body = arkRequest.getBody();

      String bucketName = body.getString("bucketName");

      // Get all the files from S3 bucket
      ListObjectsV2Request listObjectsRequest =
          new ListObjectsV2Request().withBucketName(bucketName);

      ListObjectsV2Result objectListing = s3Client.listObjectsV2(listObjectsRequest);

      for (S3ObjectSummary objectSummary : objectListing.getObjectSummaries()) {
        String key = objectSummary.getKey();

        if (key.endsWith("-pdf.txt")) {

          S3Object object = s3Client.getObject(bucketName, key);
          InputStream objectData = object.getObjectContent();
          String content = IOUtils.toString(objectData, StandardCharsets.UTF_8);

          JSONObject jsonObject = new JSONObject(content);

          // These fields are specified from Zapier Action...
          // Now, we extract content and Chunk it by 512 size; then upsert it to Pinecone
          // Normalize the extracted content....

          System.out.println("Filename: " + jsonObject.getString("filename")); // abcd.pdf
          System.out.println("Extension: " + jsonObject.getString("file_extension")); // pdf

          String normalizedText =
              Unidecode.decode(jsonObject.getString("text")).replaceAll("[\t\n\r]+", " ");
          Chunker chunker = new Chunker(normalizedText);
          String[] arr = chunker.byChunkSize(512);

          // Upsert to Pinecone:
          PineconeRetrieval retrieval =
              new PineconeRetrieval(arr, pineconeEndpoint, namespace, arkRequest);

          retrieval.upsert();

          System.out.println("File is parsed: " + key); // For Logging
        }
      }
    }

    @DeleteMapping("/pinecone/deleteAll")
    public ArkResponse deletePinecone(ArkRequest arkRequest) {
      String namespace = arkRequest.getQueryParam("namespace");
      return new EdgeChain<>(pineconeEndpoint.deleteAll(namespace)).getArkResponse();
    }

    private void zapWebHook(String url) {

      WebClient webClient = WebClient.builder().baseUrl(ZAPIER_HOOK_URL).build();

      JSONObject json = new JSONObject();
      json.put("url", url);

      webClient
          .post()
          .contentType(MediaType.APPLICATION_JSON)
          .body(BodyInserters.fromValue(json.toString()))
          .retrieve()
          .bodyToMono(String.class)
          .retryWhen(Retry.fixedDelay(3, Duration.ofSeconds(20))) // Using Fixed Delay..
          .block();
    }
  }
}
