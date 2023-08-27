package com.edgechain.postgres;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
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

//import static org.junit.Assert.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@RunWith(MockitoJUnitRunner.class)
public class PostgresClientMetadataRepositoryTest {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());
    @Mock
    private JdbcTemplate jdbcTemplate;

    PostgresEndpoint postgresEndpoint;
    @InjectMocks
    private PostgresClientMetadataRepository repository;

    @Captor
    private ArgumentCaptor<String> sqlQueryCaptor;

    @BeforeEach
    public void setUp() {
         postgresEndpoint = mock(PostgresEndpoint.class);
    }

    @Test
    @DisplayName("Test if jdbcTemplate execute method is called twice for createTable() and verifying sql queries")
    public void testCreateTable_NonEmptyMetadataTableNames() {
        //Arrange
        when(postgresEndpoint.getMetadataTableNames()).thenReturn(Collections.singletonList("metadataTestTable"));

        //Act
        repository.createTable(postgresEndpoint);

        //Assert
        verify(jdbcTemplate, times(2)).execute(sqlQueryCaptor.capture());

        //Check for SQL queries

        List<String> capturedSqlQueries = sqlQueryCaptor.getAllValues();

        // Assert that the first query is for creating the metadata table
        assertTrue(capturedSqlQueries.get(0).contains("CREATE TABLE IF NOT EXISTS"));
        assertTrue(capturedSqlQueries.get(0).contains("metadata_id SERIAL PRIMARY KEY"));
        assertTrue(capturedSqlQueries.get(0).contains("metadata TEXT"));
        assertTrue(capturedSqlQueries.get(0).contains("metadata_embedding vector"));

        // Assert that the second query is for creating the join table
        assertTrue(capturedSqlQueries.get(1).contains("CREATE TABLE IF NOT EXISTS"));
        assertTrue(capturedSqlQueries.get(1).contains("embedding_id INT"));
        assertTrue(capturedSqlQueries.get(1).contains("metadata_id INT"));
        assertTrue(capturedSqlQueries.get(1).contains("FOREIGN KEY (embedding_id) REFERENCES"));
        assertTrue(capturedSqlQueries.get(1).contains("FOREIGN KEY (metadata_id) REFERENCES"));
        assertTrue(capturedSqlQueries.get(1).contains("PRIMARY KEY (embedding_id, metadata_id)"));
    }

    @Test
    @DisplayName("createTable() should throw error when the metadata table names list is empty")
    public void testCreateTable_EmptyMetadataTableNames() {
        //Arrange
        when(postgresEndpoint.getMetadataTableNames()).thenReturn(Collections.emptyList());

        //Act and Assert
        assertThrows(IndexOutOfBoundsException.class, () -> repository.createTable(postgresEndpoint));
        verify(jdbcTemplate, times(0)).execute(sqlQueryCaptor.capture());
    }

    @Test
    @DisplayName("Insert metadata should return metadata id after getting inserted")
    public void testInsertMetadata_ReturnsMetadataId() {
        //Arrange
        String metadataTableName = "metadata_table";
        String metadata = "example_metadata";
        List<Float> wordEmbeddingValues = List.of(0.1f, 0.2f, 0.3f);
        WordEmbeddings wordEmbeddings = new WordEmbeddings(metadata, wordEmbeddingValues);

        //Mock the queryForObject to return the expected metadata id
        Integer expectedMetadataId = 101;
        when(jdbcTemplate.queryForObject(sqlQueryCaptor.capture(), eq(Integer.class))).thenReturn(expectedMetadataId);

        //Act
        Integer result = repository.insertMetadata(metadataTableName, metadata, wordEmbeddings);

        //Assert
        //Verify that the queryForObject method was called with the expected parameters
        verify(jdbcTemplate).queryForObject(
                eq(String.format(
                        "INSERT INTO metadata_table (metadata, metadata_embedding) VALUES ('%s', '%s') " +
                                "RETURNING metadata_id;",
                        metadata,
                        wordEmbeddingValues
                        )),
                eq(Integer.class)
        );

        //Verify that the result matches the expected metadataId
        assertEquals(expectedMetadataId, result);
    }

    @Test
    @DisplayName("Insert entry into the join table")
    public void testInsertIntoJoinTable() {
        //Arrange
        when(postgresEndpoint.getTableName()).thenReturn("embedding_table");
        when(postgresEndpoint.getMetadataTableNames()).thenReturn(Collections.singletonList("metadata_table"));
        String joinTable = postgresEndpoint.getTableName() + "_join_" + postgresEndpoint.getMetadataTableNames().get(0);

        //Act
        repository.insertIntoJoinTable(postgresEndpoint);

        //Assert
        verify(jdbcTemplate, times(1)).execute(sqlQueryCaptor.capture());

        //Verify the captured query and actual query is same or not
        String capturedQuery = sqlQueryCaptor.getValue();
        String expectedQuery = String.format("INSERT INTO %s (embedding_id, metadata_id) VALUES (%s, %s);", joinTable, postgresEndpoint.getEmbeddingId(), postgresEndpoint.getMetadataId());
        assertEquals(expectedQuery, capturedQuery);
    }

    @Test
    @DisplayName("Query with metadata")
    public void testQueryWithMetadata() {
        //Arrange
        String tableName = "embedding_table";
        String metadataTableName = "metadata_table";
        String namespace = "example_namespace";
        int probes = 1;
        PostgresDistanceMetric metric = PostgresDistanceMetric.L2;
        List<Float> wordEmbeddingValues = List.of(0.1f, 0.2f, 0.3f);
        WordEmbeddings wordEmbeddings = new WordEmbeddings("", wordEmbeddingValues);
        int topK = 5;

        //Mock queryForList method to return a dummy result
        List<Map<String, Object>> dummyResult = List.of(
                Map.of("id", "xyz21", "metadata", "example_metadata", "metadata_id", 1, "raw_text", "example_raw_text",
                        "namespace", "example_namespace", "filename", "example_filename", "timestamp", "example_timestamp", "score", 0.5)
        );
        when(jdbcTemplate.queryForList(anyString())).thenReturn(dummyResult);

        //Act
        List<Map<String, Object>> result = repository.queryWithMetadata(
                tableName, metadataTableName, namespace, probes, metric, wordEmbeddings, topK
        );

        // Assert
        verify(jdbcTemplate).queryForList(anyString());
        assertEquals(dummyResult, result);
    }

    @Test
    @DisplayName("Similarity search on metadata table")
    public void testSimilaritySearchMetadata() {
        //Arrange
        String metadataTableName = "metadata_table";
        PostgresDistanceMetric metric = PostgresDistanceMetric.L2;
        List<Float> wordEmbeddingValues = List.of(0.1f, 0.2f, 0.3f);
        WordEmbeddings wordEmbeddings = new WordEmbeddings("", wordEmbeddingValues);
        int topK = 5;

        //Mock queryForList method to return a dummy result
        List<Map<String, Object>> dummyResult = List.of(
                Map.of("metadata_id", 1, "metadata", "example_metadata", "score", 0.5)
        );
        when(jdbcTemplate.queryForList(anyString())).thenReturn(dummyResult);

        //Act
        List<Map<String, Object>> result = repository.similaritySearchMetadata(
                metadataTableName, metric, wordEmbeddings, topK
        );

        // Assert
        verify(jdbcTemplate).queryForList(sqlQueryCaptor.capture());
        assertEquals(dummyResult, result);
    }
}
