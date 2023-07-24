package com.edgechain.chunker;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import com.edgechain.lib.chunk.Chunker;
import com.edgechain.lib.chunk.enums.LangType;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class ChunkerTest {

  @LocalServerPort int randomServerPort;

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @BeforeEach
  public void setup() {
    System.setProperty("server.port", "" + randomServerPort);
  }

  @Test
  @DisplayName("Test By Chunk Size")
  public void chunker_ByChunkSize_ReturnExpectedValue(TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String input = "This is a test string for chunking.";
    Chunker chunker = new Chunker(input);
    int chunkSize = 5;

    String[] result = chunker.byChunkSize(chunkSize);

    String[] expected = {"This", "is a", "test", "strin", "g for", "chun", "king."};
    assertArrayEquals(expected, result);
  }

  @Test
  @DisplayName("Test By Sentence")
  public void chunker_BySentence_ReturnExpectedValue(TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String input = "This is sentence one. Sentence two. Sentence three.";
    Chunker chunker = new Chunker(input);
    LangType langType = LangType.EN;

    String[] result = chunker.bySentence(langType);

    String[] expected = {"This is sentence one.", "Sentence two.", "Sentence three."};
    assertArrayEquals(expected, result);
  }

  @Test
  @DisplayName("Test By Chunk Size With Empty Input ")
  public void chunker_ByChunkSizeWithEmptyInput_ReturnEmptyArray(TestInfo testInfo)
      throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String input = "";
    Chunker chunker = new Chunker(input);
    int chunkSize = 5;

    String[] result = chunker.byChunkSize(chunkSize);

    String[] expected = {};
    assertArrayEquals(expected, result);
  }

  @Test
  @DisplayName("Test By Sentence With Empty Input ")
  public void chunker_BySentenceWithEmptyInput_ReturnEmptyArray(TestInfo testInfo)
      throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String input = "This is a test.";
    Chunker chunker = new Chunker(input);
    int chunkSize = 100;

    String[] result = chunker.byChunkSize(chunkSize);

    String[] expected = {"This is a test."};
    assertArrayEquals(expected, result);
  }
}
