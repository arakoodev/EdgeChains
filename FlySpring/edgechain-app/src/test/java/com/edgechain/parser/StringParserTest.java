package com.edgechain.parser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import com.edgechain.lib.openai.parser.StringParser;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class StringParserTest {

    @LocalServerPort
    int randomServerPort;

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    @BeforeEach
    public void setup() {
        System.setProperty("server.port", "" + randomServerPort);
    }

    @Test
    @DisplayName("Test string parser Get Thought Content")
    public void StringParser_GetThoughtContent_ReturnsExpectedValue() throws Exception {

        logger.info("======== " + "Test Get Thought Content" + " ========");

        String input = "Thought 1: Lorem ipsum\nAction 1: [Search: Content for action 1]\nObservation 1: Some observation";
        StringParser parser = new StringParser(input);

        String[] thoughts = parser.getThoughts();

        assertEquals(1, thoughts.length);
        assertEquals("Thought 1: Lorem ipsum", thoughts[0]);
    }

    @Test
    @DisplayName("Test string parser Get Action Content")
    public void StringParser_GetActionContent_ReturnsExpectedValue() throws Exception {

        logger.info("======== " + "Test Get Action Content" + " ========");

        String input = "Thought 1: Lorem ipsum\nAction 1: [Search: Content for action 1]\nObservation 1: Some observation";
        StringParser parser = new StringParser(input);

        String[] actions = parser.getActions();

        assertEquals(1, actions.length);
        assertEquals("Action 1: [Search: Content for action 1]", actions[0]);
    }

    @Test
    @DisplayName("Test string parser Get Observation Content")
    public void StringParser_GetObservationContent_ReturnsExpectedValue() throws Exception {

        logger.info("======== " + "Test Get Observation Content" + " ========");

        String input = "Thought 1: Lorem ipsum\nAction 1: [Search: Content for action 1]\nObservation 1: Some observation";
        StringParser parser = new StringParser(input);

        String[] observations = parser.getObservations();

        assertEquals(1, observations.length);
        assertEquals("Observation 1: Some observation", observations[0]);
    }

    @Test
    @DisplayName("Test string parser Get Final Answer")
    public void StringParser_GetFinalAnswer_ReturnsExpectedValue() throws Exception {

        logger.info("======== " + "Test Get Final Answer" + " ========");

        String input = "Thought 1: Lorem ipsum\nObservation 1: Some observation\nAction 1: Finish[Final Answer]";
        StringParser parser = new StringParser(input);

        String[] actions = parser.getActions();
        String finalAnswer = null;

        if (actions != null && actions.length > 0) {
            // Check if the last action contains the final answer
            String lastAction = actions[actions.length - 1];
            int startIndex = lastAction.indexOf("Finish[");
            if (startIndex >= 0) {
                finalAnswer = lastAction.substring(startIndex + 7); // 7 is the length of "Finish["
                int endIndex = finalAnswer.indexOf("]");
                if (endIndex >= 0) {
                    finalAnswer = finalAnswer.substring(0, endIndex);
                }
            }
        }

        assertNotNull(finalAnswer);
        assertEquals("Final Answer", finalAnswer);
    }

}
