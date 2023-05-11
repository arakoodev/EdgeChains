package com.app.openaiwiki.services.impl;

import com.app.openai.embeddings.WordVec;
import com.app.openai.embeddings.openai.OpenAiEmbeddingResponse;
import com.app.openai.embeddings.service.EmbeddingService;
import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.provider.impl.OpenAIEmbeddingProvider;
import com.app.openai.llm.service.LLMService;
import com.app.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import me.xuender.unidecode.Unidecode;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.pdf.PDFParser;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.web.multipart.MultipartFile;

import java.util.stream.IntStream;

public class PDFEmbeddingService {

  private final EmbeddingService embeddingService;
  private final Endpoint openAiEndpoint;
  private final String model;
  private final int chunkSize;

  public PDFEmbeddingService(
      EmbeddingService embeddingService, Endpoint openAiEndpoint, int chunkSize) {
    this.embeddingService = embeddingService;
    this.openAiEndpoint = openAiEndpoint;
    this.chunkSize = chunkSize;
    this.model = "text-embedding-ada-002";
  }

  public PDFEmbeddingService(
      EmbeddingService embeddingService, Endpoint openAiEndpoint, String model) {
    this.embeddingService = embeddingService;
    this.openAiEndpoint = openAiEndpoint;
    this.model = model;
    this.chunkSize = 512;
  }

  public PDFEmbeddingService(EmbeddingService embeddingService, Endpoint openAiEndpoint) {
    this.embeddingService = embeddingService;
    this.openAiEndpoint = openAiEndpoint;
    this.model = "text-embedding-ada-002";
    this.chunkSize = 512;
  }

  public PDFEmbeddingService(
      EmbeddingService embeddingService, Endpoint openAiEndpoint, String model, int chunkSize) {
    this.embeddingService = embeddingService;
    this.openAiEndpoint = openAiEndpoint;
    this.model = model;
    this.chunkSize = chunkSize;
  }

  public EdgeChain<String> upsert(MultipartFile file) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                BodyContentHandler contentHandler = new BodyContentHandler(-1);
                Metadata data = new Metadata();
                ParseContext context = new ParseContext();
                PDFParser pdfparser = new PDFParser();
                pdfparser.parse(file.getInputStream(), contentHandler, data, context);
                String[] arr =
                    splitToChunks(
                        Unidecode.decode(contentHandler.toString()).replaceAll("[\t\n\r]+", " "),
                        chunkSize);

                LLMService openAiEmbedding =
                    new LLMService(new OpenAIEmbeddingProvider(openAiEndpoint, model));

                IntStream.range(0, arr.length)
                    .parallel()
                    .forEach(
                        (i) -> {
                          openAiEmbedding
                              .request(arr[i])
                              .transform(
                                  response ->
                                      new ObjectMapper()
                                          .readValue(response, OpenAiEmbeddingResponse.class))
                              .transform(
                                  embeddingResponse ->
                                      new WordVec(
                                          arr[i],
                                          embeddingResponse.getData().get(0).getEmbedding()))
                              .transform(wordVec -> embeddingService.upsert(wordVec).getWithRetry())
                              .doOnError(System.err::println)
                              .getWithRetry(Schedulers.io());
                        });

                emitter.onNext("Vectors Upserted");
                emitter.onComplete();
              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  private static String[] splitToChunks(String input, int chunkSize) {
    int noOfChunks = (int) Math.ceil((float) input.length() / chunkSize);

    return IntStream.range(0, noOfChunks)
        .parallel()
        .mapToObj(
            i -> {
              int start = i * chunkSize;
              int end = Math.min((i + 1) * chunkSize, input.length());
              return input.substring(start, end).strip();
            })
        .toArray(String[]::new);
  }
}
