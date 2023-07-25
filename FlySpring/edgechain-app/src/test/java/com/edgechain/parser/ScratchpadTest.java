package com.edgechain.parser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;

import com.edgechain.lib.openai.parser.Scratchpad;

@SpringBootTest
public class ScratchpadTest {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @Test
  @DisplayName("Test Get Action Content")
  public void Scratchpad_GetActionContent_ReturnsExpectedValue(TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String input =
        "Thought 1: Lorem ipsum\n"
            + "Action 1: [Search: Content for action 1]\n"
            + "Observation 1: Some observation";
    Scratchpad scratchpad = new Scratchpad(input);

    String actionContent = scratchpad.getActionContent();

    assertEquals("Search: Content for action 1", actionContent);
  }

  @Test
  @DisplayName("Test Get Action Content No Action")
  public void Scratchpad_GetActionContentNoAction_ReturnsNull(TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String input =
        "Thought 1: Lorem ipsum\nAction 1: [Some other action]\nObservation 1: Some observation";
    Scratchpad scratchpad = new Scratchpad(input);

    String actionContent = scratchpad.getActionContent();

    assertNull(actionContent);
  }

  @Test
  @DisplayName("Test Observation Replacer Update Existing Observation")
  public void scratchpad_ObservationReplacer_UpdateExistingObservation(TestInfo testInfo)
      throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String input =
        "Thought 1: Lorem ipsum\n"
            + "Action 1: [Search: Content for action 1]\n"
            + "Observation 1: Initial observation";
    Scratchpad scratchpad = new Scratchpad(input);

    scratchpad.observationReplacer("Updated observation");

    assertEquals("Observation: Updated observation", scratchpad.getScratchpadList().get(2));
  }

  @Test
  @DisplayName("Test Observation Replacer Add New Observation")
  public void scratchpad_ObservationReplacer_AddNewObservation(TestInfo testInfo) throws Exception {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String input = "Thought 1: Lorem ipsum\nAction 1: [Search: Content for action 1]";
    Scratchpad scratchpad = new Scratchpad(input);

    scratchpad.observationReplacer("New observation");

    assertEquals("Observation: New observation", scratchpad.getScratchpadList().get(2));
  }
}
