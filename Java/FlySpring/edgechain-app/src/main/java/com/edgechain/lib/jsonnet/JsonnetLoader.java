package com.edgechain.lib.jsonnet;

import com.edgechain.lib.jsonnet.enums.DataType;
import com.edgechain.lib.jsonnet.exceptions.JsonnetLoaderException;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.jam01.xtrasonnet.Transformer;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.RandomStringUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.util.*;

@JsonTypeInfo(use = JsonTypeInfo.Id.CLASS)
public abstract class JsonnetLoader implements Serializable {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  private String f1;
  private String f2;

  private String metadata;
  private String selectedFile;

  private int threshold = 0;

  private String splitSize;

  private Map<String, JsonnetArgs> args = new HashMap<>();
  private Map<String, String> xtraArgsMap = new HashMap<>();
  private static final ObjectMapper objectMapper = new ObjectMapper();
  private JSONObject jsonObject;

  public JsonnetLoader() {}

  public JsonnetLoader(String f1) {
    this.f1 = f1;
  }

  public JsonnetLoader(int threshold, String f1, String f2) {
    this.f1 = f1;
    this.f2 = f2;
    if (threshold >= 1 && threshold < 100) {
      this.threshold = threshold;
      this.splitSize =
          String.valueOf(threshold).concat("-").concat(String.valueOf((100 - threshold)));
    } else throw new RuntimeException("Threshold has to be b/w 1 and 100");
  }

  public void load(InputStream in1, InputStream in2) {
    int randValue = (int) (Math.random() * 101);
    if (randValue <= threshold) {
      this.selectedFile = getF1();
      logger.info("Using File: " + getF1());
      load(in1);
    } else {
      this.selectedFile = getF2();
      logger.info("Using File: " + getF2());
      load(in2);
    }
  }

  public void load(InputStream inputStream) {
    try {
      preconfigured();

      // Create Temp File With Unique Name
      String filename =
          RandomStringUtils.randomAlphanumeric(12) + "_" + System.currentTimeMillis() + ".jsonnet";
      File file = new File(System.getProperty("java.io.tmpdir") + File.separator + filename);

      BufferedReader br = new BufferedReader(new InputStreamReader(inputStream));

      StringBuilder sb = new StringBuilder();
      String line;
      while ((line = br.readLine()) != null) {
        sb.append(line).append(System.lineSeparator());
      }

      String text = sb.toString().replaceAll("[\r]+", "");

      PrintWriter printWriter = new PrintWriter(file);
      printWriter.write(text);
      printWriter.flush();
      printWriter.close();
      br.close();

      // Transform Jsonnet Args
      for (Map.Entry<String, JsonnetArgs> entry : this.args.entrySet()) {

        if (entry.getValue().getDataType().equals(DataType.STRING)) {
          String regex = "[^\\p{L}\\p{N}\\p{P}\\p{Z}]";

          xtraArgsMap.put(entry.getKey(), entry.getValue().getVal().replaceAll(regex, ""));

        } else if (entry.getValue().getDataType().equals(DataType.INTEGER)
            || entry.getValue().getDataType().equals(DataType.BOOLEAN)) {
          xtraArgsMap.put(entry.getKey(), entry.getValue().getVal());
        }
      }

      var res =
          Transformer.builder(text)
              .withLibrary(new XtraSonnetCustomFunc())
              .build()
              .transform(serializeXtraArgs(xtraArgsMap));
      // Get the String Output & Transform it into JsonnetSchema

      this.metadata = res;
      this.jsonObject = new JSONObject(res);

      // Delete File
      FileUtils.deleteQuietly(file);

    } catch (final Exception e) {
      throw new JsonnetLoaderException(e.getMessage());
    }
  }

  private static String serializeXtraArgs(Map<String, String> xtraArgsMap) {
    try {
      return objectMapper.writeValueAsString(xtraArgsMap);
    } catch (Exception e) {
      e.printStackTrace();
      return "{}";
    }
  }

  public abstract JsonnetLoader loadOrReload();

  public JsonnetLoader put(String key, JsonnetArgs args) {
    this.args.put(key, args);
    return this;
  }

  public Map<String, JsonnetArgs> getArgs() {
    return args;
  }

  public String get(String key) {
    return this.jsonObject.getString(key);
  }

  public JSONArray getArray(String key) {
    return this.jsonObject.getJSONArray(key);
  }

  public int getInt(String key) {
    return this.jsonObject.getInt(key);
  }

  public boolean getBoolean(String key) {
    return this.jsonObject.getBoolean(key);
  }

  private void preconfigured() {
    Map<String, JsonnetArgs> args = this.getArgs();

    if (Objects.isNull(args.get("keepContext"))) {
      args.put("keepContext", new JsonnetArgs(DataType.BOOLEAN, "false"));
    }

    if (Objects.isNull(args.get("keepMaxTokens")))
      args.put("keepMaxTokens", new JsonnetArgs(DataType.BOOLEAN, "false"));
  }

  public String getMetadata() {
    return metadata;
  }

  public String getSelectedFile() {
    return selectedFile;
  }

  public String getF1() {
    return f1;
  }

  public String getF2() {
    return f2;
  }

  public int getThreshold() {
    return threshold;
  }

  public String getSplitSize() {
    return splitSize;
  }
}
