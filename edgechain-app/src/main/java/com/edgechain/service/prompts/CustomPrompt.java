package com.edgechain.service.prompts;

import com.edgechain.lib.openai.prompt.PromptTemplate;
import com.edgechain.service.prompts.schemas.JsonnetSchema;
import com.google.gson.JsonObject;

import java.util.HashMap;
import java.util.Map;
import com.edgechain.service.prompts.runners.JsonnetRunner;

public class CustomPrompt implements PromptTemplate {
  private String sourceTemplateLocation;
  private JsonnetSchema jsonnetSchema;
  private JsonnetRunner jsonnetRunner;
  private String prompt;
  private Map<String, String> extVarSettings;

  public CustomPrompt() {
    this.jsonnetRunner = new JsonnetRunner();
    this.extVarSettings = new HashMap<String, String>();
  }

  public CustomPrompt(String templateLocation) {
    this.sourceTemplateLocation = templateLocation;
    this.jsonnetRunner = new JsonnetRunner();
    this.extVarSettings = new HashMap<String, String>();
  }

  public CustomPrompt setTemplateLocation(String templateLocation) {
    this.sourceTemplateLocation = templateLocation;

    return this;
  }

  private void parsePrompt() {
    /*
     * The output of the Jsonnet must have the field called "prompt" containing the
     * processed prompt.
     */
    JsonObject jsonObject = jsonnetRunner.executor(this.sourceTemplateLocation, extVarSettings);
    this.prompt = jsonObject.get("prompt").getAsString();
  }

  public CustomPrompt addExtVarSettings(Map<String, String> extVarSettings) {
    for (Map.Entry<String, String> settingsEntry : extVarSettings.entrySet()) {
      this.extVarSettings.put(settingsEntry.getKey(), settingsEntry.getValue());
    }

    return this;
  }

  public String getPrompt() {
    this.parsePrompt();
    return this.prompt;
  }

  // public static void main(String[] args) {
  // String customPrompt = new CustomPrompt()
  // .setTemplateLocation(
  // "/media/anuran/Samsung_SSD_970_EVO_1TB/Internship/GSSoC_2k23/EdgeChains/EdgeChains/Examples/jsonnet_impl/src/main/java/com/jsonnet/foo.jsonnet")
  // .addExtVarSettings(new HashMap<String, String>()).getPrompt();

  // System.out.println(customPrompt);
  // }
}
