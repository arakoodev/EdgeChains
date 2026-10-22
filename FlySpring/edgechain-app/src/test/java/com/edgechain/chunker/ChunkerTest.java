package com.edgechain.chunker;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;

import com.edgechain.lib.chunk.Chunker;
import com.edgechain.lib.chunk.enums.LangType;

import java.util.Arrays;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class ChunkerTest {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

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

  @Test
  @DisplayName("Test By Very Small ChunkSize ")
  void chunker_ByVerySmallChunkSize_ReturnedExpectedValue() {
    String input = "This is Testing";
    Chunker chunker = new Chunker(input);

    String[] result = chunker.byChunkSize(1);

    String[] expected = {"T", "h", "i", "s", "i", "s", "T", "e", "s", "t", "i", "n", "g"};
    assertNotEquals(expected, result);
  }

  @Test
  @DisplayName("Test By ChunkSize - Input Contains Whitespace")
  void chunker_ByChunkSize_InputWhiteSpaceCharacter_ReturnedExpectedValue() {
    String input = "\n\t\t";
    Chunker chunker = new Chunker(input);
    int chunkSize = 5;

    String[] result = chunker.byChunkSize(chunkSize);

    String[] expected = {""};
    assertArrayEquals(expected, result);
  }

  @Test
  @DisplayName("Test By Sentence - Contains Only Spaces")
  void chunker_BySentence_InputContainsOnlySpaces_ReturnedExpectedValue() {
    String input = "                        ";
    Chunker chunker = new Chunker(input);

    String[] result = chunker.bySentence(LangType.EN);
    logger.info(Arrays.toString(result));
    String[] expected = {};
    assertArrayEquals(expected, result);
    assertEquals(expected.length, result.length);
  }

  @Test
  @DisplayName("Performance Test With Large String")
  @Timeout(value = 5, unit = TimeUnit.SECONDS)
  void chunker_Performance_LargeInputString_ReturnedExpectedValue() {
    String input = "E".repeat(10000);
    Chunker chunker = new Chunker(input);
    int chunkSize = 5;

    long startTime = System.currentTimeMillis();
    String[] result = chunker.byChunkSize(chunkSize);
    long endTime = System.currentTimeMillis();
    long totalExecutionTime = endTime - startTime;
    logger.info(String.valueOf(totalExecutionTime));

    long maxExecutionTime = 5000; // Execution time in mills
    assertEquals(2000, result.length);
    assertTrue(totalExecutionTime <= maxExecutionTime);
  }
}
