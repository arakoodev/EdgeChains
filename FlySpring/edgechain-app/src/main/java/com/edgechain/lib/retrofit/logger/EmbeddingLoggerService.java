package com.edgechain.lib.retrofit.logger;

import com.edgechain.lib.logger.entities.EmbeddingLog;
import io.reactivex.rxjava3.core.Single;
import org.springframework.data.domain.Page;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;

import java.util.HashMap;

public interface EmbeddingLoggerService {

  @GET(value = "logs/embeddings/findAll/{page}/{size}")
  Single<Page<EmbeddingLog>> findAll(@Path("page") int page, @Path("size") int size);

  @GET(value = "logs/embeddings/findAll/sorted/{page}/{size}")
  Single<Page<EmbeddingLog>> findAllOrderByCompletedAtDesc(
      @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/embeddings/findByModel/{page}/{size}")
  Single<Page<EmbeddingLog>> findAllByModel(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/embeddings/findByModel/sorted/{page}/{size}")
  Single<Page<EmbeddingLog>> findAllByModelOrderByCompletedAtDesc(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/embeddings/findByIdentifier/{page}/{size}")
  Single<Page<EmbeddingLog>> findAllByCallIdentifier(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/embeddings/findByIdentifier/sorted/{page}/{size}")
  Single<Page<EmbeddingLog>> findAllByCallIdentifierOrderByCompletedAtDesc(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/embeddings/findByLatencyLessThanEq/{page}/{size}")
  Single<Page<EmbeddingLog>> findAllByLatencyLessThanEqual(
      @Body HashMap<String, Long> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/embeddings/findByLatencyGtrThanEq/{page}/{size}")
  Single<Page<EmbeddingLog>> findAllByLatencyGreaterThanEqual(
      @Body HashMap<String, Long> mapper, @Path("page") int page, @Path("size") int size);
}
