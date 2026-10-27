package com.edgechain.codeInterpreter;

import static org.junit.Assert.assertFalse;
import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;

public class CodeInterpreterTest {

  @Test
  @DisplayName("Test concatStrings method in JSONnet")
  public void test_extract_method() throws Exception {
    String inputJsonnet =
        "local extract(example, prompt) =\n"
            + "    local result = example + \" \" + prompt;\n"
            + "    result;\n"
            + "{ \"extract\": extract(\" You are a Reasoning + Acting (React) Chain Bot. You have"
            + " to be interactive so ask the queries one by one from the user to reach to the final"
            + " answer.\", \" Question:what is 10+2 ? \") }";

    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    jsonnetLoader.load(inputStream);

    String extractedValue = jsonnetLoader.get("extract");
    assertNotNull(extractedValue);

    // assert
    String expectedOutput =
        " You are a Reasoning + Acting (React) Chain Bot. You have to be interactive so ask the"
            + " queries one by one from the user to reach to the final answer.  Question:what is"
            + " 10+2 ? ";
    assertEquals(expectedOutput, extractedValue);
    assertTrue(extractedValue.contains("You are a Reasoning"));
    assertTrue(extractedValue.contains("Question:what is 10+2 ?"));
  }

  @Test
  @DisplayName("Test extraction with empty questions")
  public void test_empty_example_extraction() throws Exception {

    String prompt = "Question: What is 2 + 2?";
    String inputJsonnet =
        "local extract(example, prompt) =\n"
            + "    local result = example + \" \" + prompt;\n"
            + "    result;\n"
            + "{ \"extract\": extract(\" You are a Reasoning + Acting (React) Chain Bot. You have"
            + " to be interactive so ask the queries one by one from the user to reach to the final"
            + " answer.\", \"    \") }";

    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    jsonnetLoader.load(inputStream);

    String extractedValue = jsonnetLoader.get("extract");
    assertNotNull(extractedValue);
    assertFalse(extractedValue.contains(prompt));
  }

  @Test
  @DisplayName("Test for empty input")
  void test_emptyInput_ReturnedExpectedValue() {
    String inputJsonnet = "";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();

    assertThrows(Exception.class, () -> jsonnetLoader.load(inputStream));
  }
}
