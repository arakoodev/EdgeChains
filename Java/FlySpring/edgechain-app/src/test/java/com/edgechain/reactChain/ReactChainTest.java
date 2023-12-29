package com.edgechain.reactChain;

import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.exceptions.JsonnetLoaderException;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
public class ReactChainTest {

  @Test
  @DisplayName("Test extractAction method for Reach Chain")
  public void test_extractAction_fromJsonnet() throws Exception {
    String inputJsonnet =
        "local extractAction(str) =\n"
            + "    local action = xtr.strings.substringBefore(xtr.strings.substringAfter(str,"
            + " \"[\"), \"]\");\n"
            + "    action;\n"
            + "{ \"action\": extractAction(\"Thought 1: I need to search ABC and XYZ, and find"
            + " which was started first.Action 1: Search[ABC]\") }";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    jsonnetLoader.load(inputStream);
    String action = jsonnetLoader.get("action");
    assertNotNull(action);
    assertEquals(action, "ABC");
  }

  @Test
  @DisplayName("Test extractThought method for Reach Chain")
  public void test_extractThought_fromJsonnet() throws Exception {
    String inputJsonnet =
        "local extractThought(str) =\n"
            + "   local thought = xtr.strings.substringAfter(xtr.strings.substringBefore(str,"
            + " \"Action\"), \":\");\n"
            + "   thought;\n"
            + "{ \"thought\": extractThought(\"Thought 1:I need to search ABC and XYZ, and find"
            + " which was started first.Action 1: Search[ABC]\") }";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    jsonnetLoader.load(inputStream);
    String thought = jsonnetLoader.get("thought");
    assertNotNull(thought);
    assertEquals(thought, "I need to search ABC and XYZ, and find which was started first.");
  }

  @Test
  @DisplayName("Mapper search function test")
  public void test_mapper() {
    String inputJsonnet =
        """
                        local config = {
                          "edgechains.config": {
                            "mapper": {
                              "search": "udf.fn",
                            },
                          },
                        };
                        local callFunction(funcName) =
                            local mapper = config["edgechains.config"].mapper;
                            mapper[funcName];
                        local searchFunction = callFunction("search");
                        { "searchFunction": searchFunction }
                        """;
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    jsonnetLoader.load(inputStream);
    String searchFunction = jsonnetLoader.get("searchFunction");
    assertNotNull(searchFunction);
    assertEquals(searchFunction, "udf.fn");
  }

  @Test
  @DisplayName("Test extractAction with invalid input")
  void test_extractAction_WithInvalidJsonnet() throws Exception {
    String inputJsonnet = "This is invalid jsonnet.";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    assertThrows(Exception.class, () -> jsonnetLoader.load(inputStream));
  }

  @Test
  @DisplayName("Test extractAction with empty input")
  void test_extractAction_withEmptyJsonnet() throws Exception {
    String inputJsonnet = "";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    assertThrows(Exception.class, () -> jsonnetLoader.get("action"));
    assertThrows(Exception.class, () -> jsonnetLoader.load(inputStream));
  }

  @Test
  @DisplayName("Test extractThought - invalid input")
  void test_extractThought_WithInvalidInput() {
    String inputJsonnet = "This is not a valid jsonnet pattern";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    assertThrows(Exception.class, () -> jsonnetLoader.load(inputStream));
  }

  @Test
  @DisplayName("Test Mapper - Missing function")
  public void test_mapper_MissingFunction_ReturnedExpectedResult() {
    String inputJsonnet =
        """
                    local config = {
                      "edgechains.config": {
                        "mapper": {},
                      },
                    };
                    """;
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    assertThrows(JsonnetLoaderException.class, () -> jsonnetLoader.load(inputStream));
  }
}
