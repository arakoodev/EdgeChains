package com.edgechain.jsonnet;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

import com.edgechain.lib.jsonnet.JsonnetArgs;
import com.edgechain.lib.jsonnet.enums.DataType;
import org.json.JSONArray;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;

import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.impl.FileJsonnetLoader;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
public class JsonnetLoaderTest {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @Test
  @DisplayName("Test Load Jsonnet file")
  public void jsonLoader_LoadJsonnet_ReturnExpectedValue(TestInfo testInfo) {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String inputJsonnet = "{ \"key\": \"value\" }";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();

    jsonnetLoader.load(inputStream);
    String value = jsonnetLoader.get("key");

    assertEquals("value", value);
  }

  @Test
  @DisplayName("Test Load Jsonnet file with array")
  public void jsonLoader_LoadJsonnetWithArray_ReturnExpectedValue(TestInfo testInfo) {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String inputJsonnet = "{ \"array\": [1, 2, 3] }";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();

    jsonnetLoader.load(inputStream);
    JSONArray array = jsonnetLoader.getArray("array");

    assertNotNull(array);
    assertEquals(3, array.length());
    assertEquals(1, array.getInt(0));
    assertEquals(2, array.getInt(1));
    assertEquals(3, array.getInt(2));
  }

  @Test
  @DisplayName("Test Load Jsonnet file with object")
  public void jsonLoader_LoadJsonnetWithObject_ReturnExpectedValue(TestInfo testInfo) {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String inputJsonnet = "{ \"number\": 42 }";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();

    jsonnetLoader.load(inputStream);
    int number = jsonnetLoader.getInt("number");

    assertEquals(42, number);
  }

  @Test
  @DisplayName("Test Load Jsonnet file with boolean")
  public void jsonLoader_LoadJsonnetWithBoolean_ReturnExpectedValue(TestInfo testInfo) {

    logger.info("======== " + testInfo.getDisplayName() + " ========");

    String inputJsonnet = "{ \"flag\": true }";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();

    jsonnetLoader.load(inputStream);
    boolean flag = jsonnetLoader.getBoolean("flag");

    assertTrue(flag);
  }

  // Test for accessing external variable with xtrasonnet library
  @Test
  @DisplayName("Test external variable with xtrasonnet")
  public void test_external_variable_xtrasonnet() throws Exception {
    String inputJsonnet = "local externalVar = payload.x;\n{externalVar: externalVar}";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    jsonnetLoader.put("x", new JsonnetArgs(DataType.INTEGER, "5"));
    jsonnetLoader.load(inputStream);
    String externalVar = jsonnetLoader.get("externalVar");
    assertNotNull(externalVar);
    assertEquals(externalVar, "5");
  }

  @Test
  void jsonLoader_LoadJsonnet_WithInvalidJsonnet_ThrowsException() {
    String inputJsonnet = "This is a test sentence.";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    assertThrows(Exception.class, () -> jsonnetLoader.load(inputStream));
  }

  @Test
  void jsonLoader_LoadJsonnet_WithEmptyJsonnet_ThrowsExpcetion() {
    String inputJsonnet = "{}";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();
    jsonnetLoader.load(inputStream);
    assertThrows(Exception.class, () -> jsonnetLoader.get("jsonnet"));
  }

  @Test
  void jsonLoader_LoadJsonnetWithArrayOfObjects_ReturnExpectedValue(TestInfo testInfo) {
    String inputJsonnet = "{ \"objects\": [{ \"key\": \"value1\" }, { \"key\": \"value2\" }] }";
    InputStream inputStream = new ByteArrayInputStream(inputJsonnet.getBytes());
    JsonnetLoader jsonnetLoader = new FileJsonnetLoader();

    jsonnetLoader.load(inputStream);
    JSONArray objects = jsonnetLoader.getArray("objects");

    assertNotNull(objects);
    assertEquals(2, objects.length());
    assertEquals("value1", objects.getJSONObject(0).getString("key"));
    assertEquals("value2", objects.getJSONObject(1).getString("key"));
  }
}
