package com.edgechain.lib.retrofit.logger;

import com.edgechain.lib.logger.entities.ChatCompletionLog;
import io.reactivex.rxjava3.core.Single;
import org.springframework.data.domain.Page;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;

import java.util.HashMap;

public interface ChatCompletionLoggerService {

  @GET(value = "logs/chat-completion/findAll/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAll(@Path("page") int page, @Path("size") int size);

  @GET(value = "logs/chat-completion/findAll/sorted/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAllOrderByCompletedAtDesc(
      @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/chat-completion/findByName/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAllByName(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/chat-completion/findByName/sorted/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAllByNameOrderByCompletedAtDesc(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/chat-completion/findByModel/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAllByModel(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/chat-completion/findByModel/sorted/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAllByModelOrderByCompletedAtDesc(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/chat-completion/findByIdentifier/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAllByCallIdentifier(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/chat-completion/findByIdentifier/sorted/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAllByCallIdentifierOrderByCompletedAtDesc(
      @Body HashMap<String, String> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/chat-completion/findByLatencyLessThanEq/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAllByLatencyLessThanEqual(
      @Body HashMap<String, Long> mapper, @Path("page") int page, @Path("size") int size);

  @POST(value = "logs/chat-completion/findByLatencyGtrThanEq/{page}/{size}")
  Single<Page<ChatCompletionLog>> findAllByLatencyGreaterThanEqual(
      @Body HashMap<String, Long> mapper, @Path("page") int page, @Path("size") int size);
}
