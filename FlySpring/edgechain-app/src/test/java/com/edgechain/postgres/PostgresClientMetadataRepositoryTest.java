package com.edgechain.postgres;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.index.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.repositories.PostgresClientMetadataRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@RunWith(MockitoJUnitRunner.class)
public class PostgresClientMetadataRepositoryTest {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());
  @Mock private JdbcTemplate jdbcTemplate;

  PostgresEndpoint postgresEndpoint;
  @InjectMocks private PostgresClientMetadataRepository repository;

  @Captor private ArgumentCaptor<String> sqlQueryCaptor;

  @BeforeEach
  public void setUp() {
    postgresEndpoint = mock(PostgresEndpoint.class);
  }

  @Test
  @DisplayName(
      "Test if jdbcTemplate execute method is called twice for createTable() and verifying sql"
          + " queries")
  public void testCreateTable_NonEmptyMetadataTableNames() {
    // Arrange
    when(postgresEndpoint.getMetadataTableNames())
        .thenReturn(Collections.singletonList("metadataTestTable"));

    // Act
    repository.createTable(postgresEndpoint);

    // Assert
    verify(jdbcTemplate, times(3)).execute(sqlQueryCaptor.capture());
  }

  @Test
  @DisplayName("createTable() should throw error when the metadata table names list is empty")
  public void testCreateTable_EmptyMetadataTableNames() {
    // Arrange
    when(postgresEndpoint.getMetadataTableNames()).thenReturn(Collections.emptyList());

    // Act and Assert
    assertThrows(IndexOutOfBoundsException.class, () -> repository.createTable(postgresEndpoint));
    verify(jdbcTemplate, times(0)).execute(sqlQueryCaptor.capture());
  }

  @Test
  @DisplayName("Insert metadata must throw NullPointerException when metadata ID is null")
  public void testInsertMetadata_ThrowsNullPointerException() {

    // Arrange
    String tablename = "table";
    String metadataTableName = "metadata_table";
    String metadata = "example_metadata";
    String documentDate = "Aug 01, 2023";

    // Mock jdbcTemplate.queryForObject to return null
    when(jdbcTemplate.queryForObject(anyString(), eq(UUID.class), any(Object[].class)))
        .thenReturn(null);

    // Act and Assert
    assertThrows(
        NullPointerException.class,
        () -> {
          repository.insertMetadata(tablename, metadataTableName, metadata, documentDate);
        });

    // Verify that jdbcTemplate.queryForObject was called with the correct SQL query and arguments
    verify(jdbcTemplate, times(1))
        .queryForObject(sqlQueryCaptor.capture(), eq(UUID.class), any(Object[].class));
  }

  @Test
  @DisplayName("Insert entry into the join table")
  public void testInsertIntoJoinTable() {
    // Arrange
    String id = UUID.randomUUID().toString();
    String metadataId = UUID.randomUUID().toString();
    when(postgresEndpoint.getTableName()).thenReturn("embedding_table");
    when(postgresEndpoint.getMetadataTableNames())
        .thenReturn(Collections.singletonList("metadata_table"));
    when(postgresEndpoint.getId()).thenReturn(id);
    when(postgresEndpoint.getMetadataId()).thenReturn(metadataId);
    String joinTable =
        postgresEndpoint.getTableName()
            + "_join_"
            + postgresEndpoint.getMetadataTableNames().get(0);

    // Act
    repository.insertIntoJoinTable(postgresEndpoint);

    // Assert
    verify(jdbcTemplate, times(1)).execute(sqlQueryCaptor.capture());

    // Verify the captured query and actual query is same or not
    String capturedQuery = sqlQueryCaptor.getValue();
    String expectedQuery =
        String.format(
            "INSERT INTO %s (id, metadata_id) VALUES ('%s', '%s') ON CONFLICT (id) DO UPDATE SET"
                + " metadata_id = EXCLUDED.metadata_id;",
            joinTable, postgresEndpoint.getId(), postgresEndpoint.getMetadataId());
    assertEquals(expectedQuery, capturedQuery);
  }

  @Test
  @DisplayName("Query with metadata")
  public void testQueryWithMetadata() {
    // Arrange
    String tableName = "embedding_table";
    String metadataTableName = "metadata_table";
    String namespace = "example_namespace";
    int probes = 1;
    PostgresDistanceMetric metric = PostgresDistanceMetric.L2;
    List<Float> wordEmbeddingValues = List.of(0.1f, 0.2f, 0.3f);
    WordEmbeddings wordEmbeddings = new WordEmbeddings("", wordEmbeddingValues);
    int topK = 5;
    String metadataId = UUID.randomUUID().toString();
    String id = UUID.randomUUID().toString();

    // Mock queryForList method to return a dummy result
    List<Map<String, Object>> dummyResult =
        List.of(
            Map.of(
                "id",
                id,
                "metadata",
                "example_metadata",
                "document_date",
                "Aug 01, 2023",
                "metadata_id",
                metadataId,
                "raw_text",
                "example_raw_text",
                "namespace",
                "example_namespace",
                "filename",
                "example_filename",
                "timestamp",
                "example_timestamp",
                "score",
                0.5));
    when(jdbcTemplate.queryForList(anyString())).thenReturn(dummyResult);

    // Act
    List<Map<String, Object>> result =
        repository.queryWithMetadata(
            tableName,
            metadataTableName,
            namespace,
            probes,
            metric,
            wordEmbeddings.getValues(),
            topK);

    // Assert
    verify(jdbcTemplate).queryForList(sqlQueryCaptor.capture());
    assertEquals(dummyResult, result);
  }
}
