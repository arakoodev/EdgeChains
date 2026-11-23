package com.edgechain.lib.retrofit.logger;

import com.edgechain.lib.logger.entities.JsonnetLog;
import io.reactivex.rxjava3.core.Single;
import java.util.HashMap;
import org.springframework.data.domain.Page;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;

public interface JsonnetLoggerService {

  @GET(value = "logs/jsonnet/findAll/{page}/{size}")
  Single<Page<JsonnetLog>> findAll(@Path("page") int page, @Path("size") int size);

  @GET(value = "logs/jsonnet/findAll/sorted/{page}/{size}")
  Single<Page<JsonnetLog>> findAllOrderByCreatedAtDesc(
      @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/jsonnet/findByName/sorted/{page}/{size}")
  Single<Page<JsonnetLog>> findAllBySelectedFileOrderByCreatedAtDesc(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);
}
