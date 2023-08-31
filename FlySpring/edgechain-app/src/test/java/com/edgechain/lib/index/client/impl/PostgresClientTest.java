package com.edgechain.lib.index.client.impl;

import io.reactivex.rxjava3.core.Single;
import java.lang.reflect.Field;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PGobject;
import org.springframework.context.ApplicationContext;
import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.repositories.PostgresClientMetadataRepository;
import com.edgechain.lib.index.repositories.PostgresClientRepository;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.PostgresService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import retrofit2.Retrofit;

class PostgresClientTest {

  private static final String TEST_TABLE_NAME = "DAVE_TABLE";
  private static final String TEST_NAMESPACE = "CHEESE_NAMESPACE";
  private static final String TEST_FILENAME = "HI_FILENAME";
  private static final String TEST_META1 = "COW_META";
  private static final String TEST_META2 = "MOO_META";

  private PostgresClientRepository mockPostgresClientRepository;
  private PostgresClientMetadataRepository mockPostgresClientMetadataRepository;
  private PostgresEndpoint pe;
  private PostgresClient service;

  @BeforeEach
  void setup() {
    // use reflection to add content to static class
    ApplicationContext mockAppContext = mock(ApplicationContext.class);
    try {
      Field field = ApplicationContextHolder.class.getDeclaredField("context");
      field.setAccessible(true);
      field.set(null, mockAppContext);
    } catch (NoSuchFieldException | SecurityException | IllegalArgumentException
        | IllegalAccessException e) {
      fail("could not set context for test", e);
    }

    mockPostgresClientRepository = mock(PostgresClientRepository.class);
    mockPostgresClientMetadataRepository = mock(PostgresClientMetadataRepository.class);

    when(mockAppContext.getBean(PostgresClientRepository.class))
        .thenReturn(mockPostgresClientRepository);
    when(mockAppContext.getBean(PostgresClientMetadataRepository.class))
        .thenReturn(mockPostgresClientMetadataRepository);

    // use reflection to prepare a Retrofit instance
    Retrofit mockRetrofit = mock(Retrofit.class);
    try {
      Field field = RetrofitClientInstance.class.getDeclaredField("retrofit");
      field.setAccessible(true);
      field.set(null, mockRetrofit);
    } catch (NoSuchFieldException | SecurityException | IllegalArgumentException
        | IllegalAccessException e) {
      fail("could not set retrofit for test", e);
    }

    // set up a mock service - we use it to set the filename of the endpoint
    PostgresService mockPostgresService = mock(PostgresService.class);
    when(mockRetrofit.create(PostgresService.class)).thenReturn(mockPostgresService);
    when(mockPostgresService.upsert(any())).thenReturn(Single.just(444)); // any integer will do

    pe = new PostgresEndpoint(TEST_TABLE_NAME, List.of(TEST_META1, TEST_META2));
    pe.setNamespace(TEST_NAMESPACE);

    service = new PostgresClient();
    service.setPostgresEndpoint(pe);
  }

  @Test
  void upsert() {
    // GIVEN we provide a number with single quotes
    WordEmbeddings we = new WordEmbeddings("'''101'''");
    pe.upsert(we, TEST_FILENAME, 17, null, 34);

    // AND the upsert will return a value
    when(mockPostgresClientRepository.upsertEmbeddings(eq(TEST_TABLE_NAME), eq("101"),
        eq(TEST_FILENAME), eq(we), eq(TEST_NAMESPACE))).thenReturn(114);

    // WHEN we call the service
    EdgeChain<Integer> result = service.upsert(we);
    Integer val = result.get();

    // THEN it returns the expected number
    // AND the mock response proved we removed those single quotes
    assertEquals(114, val);

    // AND createTable was called
    verify(mockPostgresClientRepository).createTable(pe);
  }

  @Test
  void insertMetadata() {
    // GIVEN we provide a number with single quotes
    WordEmbeddings we = new WordEmbeddings("'''101'''");

    // AND the insert will return a value
    when(mockPostgresClientMetadataRepository.insertMetadata(eq(TEST_META1), eq("101"), eq(we)))
        .thenReturn(114);

    // WHEN we call the service
    EdgeChain<Integer> result = service.insertMetadata(we);
    Integer val = result.get();

    // THEN it returns the expected number
    // AND the mock response proved we removed those single quotes
    assertEquals(114, val);

    // AND createTable was called
    verify(mockPostgresClientMetadataRepository).createTable(pe);
  }

  @Test
  void insertIntoJoinTable() {
    // GIVEN we want to insert

    // WHEN the service is called
    EdgeChain<StringResponse> result = service.insertIntoJoinTable(pe);
    String val = result.get().getResponse();

    // THEN it returns the expected string
    assertEquals("Inserted", val);

    // AND the insert function was called
    verify(mockPostgresClientMetadataRepository).insertIntoJoinTable(pe);
  }

  @Test
  void query_noMetaData() {
    // GIVEN we provide a request
    WordEmbeddings we = new WordEmbeddings("777");

    // AND the endpoint has no meta tables
    pe = new PostgresEndpoint(TEST_TABLE_NAME);
    pe.setNamespace(TEST_NAMESPACE);
    service.setPostgresEndpoint(pe);

    // AND we will find data
    final LocalDateTime expectedDate = LocalDateTime.of(2015, 10, 11, 7, 8, 9);

    Map<String, Object> map = new HashMap<>();
    map.put("id", "777");
    map.put("raw_text", "spoons");
    map.put("filename", "readme.txt");
    map.put("timestamp", Timestamp.valueOf(expectedDate));
    map.put("namespace", "fallout");
    map.put("score", 87d);
    when(mockPostgresClientRepository.query(TEST_TABLE_NAME, TEST_NAMESPACE, 34, null, we, 19))
        .thenReturn(List.of(map));

    // WHEN the service is called
    EdgeChain<List<PostgresWordEmbeddings>> result = service.query(we, null, 19, 34);
    List<PostgresWordEmbeddings> list = result.get();

    // THEN the correct number of items are returned
    assertEquals(1, list.size());

    // AND the data was read correctly
    PostgresWordEmbeddings first = list.get(0);
    assertEquals("777", first.getId());
    assertEquals("spoons", first.getRawText());
    assertEquals("readme.txt", first.getFilename());
    assertEquals(expectedDate, first.getTimestamp());
    assertEquals("fallout", first.getNamespace());
    assertEquals(87d, first.getScore(), 0.0000001d);
  }

  @Test
  void query_haveMetaData() {
    // GIVEN we provide a request
    WordEmbeddings we = new WordEmbeddings("777");

    // AND we will find data for the first meta table
    final LocalDateTime expectedDate = LocalDateTime.of(2015, 10, 11, 7, 8, 9);
    final int metaId = 20111111;

    Map<String, Object> map1 = new HashMap<>();
    map1.put("id", "777");
    map1.put("raw_text", "spoons");
    map1.put("filename", "readme.txt");
    map1.put("timestamp", Timestamp.valueOf(expectedDate));
    map1.put("namespace", "fallout");
    map1.put("score", 87d);
    map1.put("metadata_id", metaId);

    // AND there is a row for the first table with a duplicate meta data id
    Map<String, Object> map2 = new HashMap<>();
    map2.put("id", "776");
    map2.put("raw_text", "knives");
    map2.put("filename", "readyou.txt");
    map2.put("timestamp", Timestamp.valueOf(expectedDate));
    map2.put("namespace", "fallout2");
    map2.put("score", 85d);
    map2.put("metadata_id", metaId);

    when(mockPostgresClientMetadataRepository.queryWithMetadata(TEST_TABLE_NAME, TEST_META1,
        TEST_NAMESPACE, 34, null, we, 19)).thenReturn(List.of(map1, map2));

    // AND we will find data for the second meta table
    Map<String, Object> map3 = new HashMap<>();
    map3.put("id", "778");
    map3.put("raw_text", "forks");
    map3.put("filename", "readus.txt");
    map3.put("timestamp", Timestamp.valueOf(expectedDate));
    map3.put("namespace", "fallout3");
    map3.put("score", 88d);
    map3.put("metadata_id", metaId);
    when(mockPostgresClientMetadataRepository.queryWithMetadata(TEST_TABLE_NAME, TEST_META2,
        TEST_NAMESPACE, 34, null, we, 19)).thenReturn(List.of(map3));

    // WHEN the service is called
    EdgeChain<List<PostgresWordEmbeddings>> result = service.query(we, null, 19, 34);
    List<PostgresWordEmbeddings> list = result.get();

    // THEN the correct number of items are returned (we filtered out a duplicate chunk right?)
    assertEquals(2, list.size());

    // AND the data was read correctly
    PostgresWordEmbeddings first = list.get(0);
    assertEquals("777", first.getId());
    assertEquals("spoons", first.getRawText());
    assertEquals("readme.txt", first.getFilename());
    assertEquals(expectedDate, first.getTimestamp());
    assertEquals("fallout", first.getNamespace());
    assertEquals(87d, first.getScore(), 0.0000001d);

    PostgresWordEmbeddings second = list.get(1);
    assertEquals("778", second.getId());
    assertEquals("forks", second.getRawText());
    assertEquals("readus.txt", second.getFilename());
    assertEquals(expectedDate, second.getTimestamp());
    assertEquals("fallout3", second.getNamespace());
    assertEquals(88d, second.getScore(), 0.0000001d);
  }

  @Test
  void getAllChunks() throws SQLException {
    // GIVEN there is a chunk with a list of floats
    PGobject floatData = new PGobject();
    floatData.setValue("[0.25,0.5]");

    Map<String, Object> row1 = new HashMap<>();
    row1.put("embedding_id", 34);
    row1.put("raw_text", "duck");
    row1.put("filename", "bird.txt");
    row1.put("embedding", floatData);

    when(mockPostgresClientRepository.getAllChunks(pe)).thenReturn(List.of(row1));

    // WHEN we call the service
    EdgeChain<List<PostgresWordEmbeddings>> result = service.getAllChunks(pe);
    List<PostgresWordEmbeddings> list = result.get();

    // THEN the correct number of items is returned
    assertEquals(1, list.size());

    // AND the data was read correctly
    PostgresWordEmbeddings first = list.get(0);
    assertEquals(34, first.getEmbedding_id());
    assertEquals("duck", first.getRawText());
    assertEquals("bird.txt", first.getFilename());
    assertEquals(2, first.getValues().size());
    assertEquals(0.25f, first.getValues().get(0), 0.00001f);
    assertEquals(0.5f, first.getValues().get(1), 0.00001f);
  }

  @Test
  void similaritySearchMetadata() {
    // GIVEN we provide a request
    WordEmbeddings we = new WordEmbeddings("777");

    // AND data exists
    Map<String, Object> map = new HashMap<>();
    map.put("metadata_id", 101);
    map.put("metadata", "bird");
    map.put("score", 87d);

    when(mockPostgresClientMetadataRepository.similaritySearchMetadata(eq(TEST_META1), eq(null),
        eq(we), eq(34))).thenReturn(List.of(map));

    // WHEN we call the service
    EdgeChain<List<PostgresWordEmbeddings>> result = service.similaritySearchMetadata(we, null, 34);
    List<PostgresWordEmbeddings> list = result.get();

    // THEN the correct number of items is returned
    assertEquals(1, list.size());

    // AND the data was read correct
    PostgresWordEmbeddings first = list.get(0);
    assertEquals(101, first.getMetadataId());
    assertEquals("bird", first.getRawText());
    assertEquals(87d, first.getScore(), 0.0000001d);
  }

  @Test
  void deleteAll() {
    // GIVEN we want to delete word embeddings

    // WHEN we call the service
    EdgeChain<StringResponse> result = service.deleteAll();
    String val = result.get().getResponse();

    // THEN the correct response is given
    assertEquals("Word embeddings are successfully deleted for namespace:" + TEST_NAMESPACE, val);

    // AND the repository was called with the correct parameters
    verify(mockPostgresClientRepository).deleteAll(TEST_TABLE_NAME, TEST_NAMESPACE);
  }

}
