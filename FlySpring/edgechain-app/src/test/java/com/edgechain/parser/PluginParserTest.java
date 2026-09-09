package com.edgechain.parser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;

import com.edgechain.lib.openai.plugin.parser.PluginParser;

@SpringBootTest
public class PluginParserTest {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @Test
  @DisplayName("Test Plugin Parser")
  public void pluginParser_Parse_ReturnsExpectedValue(TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String nameForModel = "PluginName";
    String openAPISpec = "{\"choices\":[{\"text\":\"Sample response\"}]}";

    String result = PluginParser.parse(nameForModel, openAPISpec);

    String expected =
        "Action: PluginName\nObservation: {\"choices\":[{\"text\":\"Sample response\"}]}";
    assertEquals(expected, result);
  }

  @Test
  @DisplayName("Test Plugin Parser No Action")
  public void pluginParser_ParseNoAction_ReturnsExpectedValue(TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    // Sample input response in JSON format
    String response =
        "{ \"choices\": [{ \"text\": \"Action Input: https://example.com/endpoint\" }, { \"text\":"
            + " \"Action Input: http://test.com\" }] }";

    List<String> urlList = PluginParser.extractUrls(response);

    // Check the size of the URL list and the presence of URLs
    assertEquals(1, urlList.size());
    assertTrue(urlList.contains("https://example.com/endpoint"));
  }

  @Test
  @DisplayName("Test Plugin Parser Get Final Answer")
  public void pluginParser_GetFinalAnswer_ReturnsExpectedValue(TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    // Sample input response in JSON format with the final answer as the first
    // choice
    String response =
        "{ \"choices\": [{ \"text\": \"Final Answer: Success\" }, { \"text\": \"Action Input:"
            + " https://example.com/endpoint\" }, { \"text\": \"Not a Final Answer\" }] }";

    String finalAnswer = PluginParser.getFinalAnswer(response);

    assertEquals("Final Answer: Success", finalAnswer);
  }

  @Test
  @DisplayName("Test Plugin Parser Get Final Answer Not Found")
  public void pluginParser_GetFinalAnswerNotFound_ReturnsNull(TestInfo testInfo) {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    // Sample input response in JSON format
    String response =
        "{ \"choices\": [{ \"text\": \"Action Input: https://example.com/endpoint\" }, { \"text\":"
            + " \"Not a Final Answer\" }] }";

    String finalAnswer = PluginParser.getFinalAnswer(response);

    assertEquals(null, finalAnswer);
  }
}
