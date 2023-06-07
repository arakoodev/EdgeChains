package com.edgechain.lib.openai.plugin.prompt;

import com.edgechain.lib.openai.plugin.response.PluginResponse;
import com.edgechain.lib.openai.prompt.PromptTemplate;

public class CompletionPrompt implements PromptTemplate {

  private final PluginResponse pluginResponse;

  public CompletionPrompt(PluginResponse pluginResponse) {
    this.pluginResponse = pluginResponse;
  }

  @Override
  public String getPrompt() {
    return "Answer the following questions as best you can. You have access to the following tools:"
               + " requests_get, "
        + pluginResponse.getPlugin().getName_for_model()
        + "\n"
        + pluginResponse.getPlugin().getName_for_model()
        + ": "
        + String.format(
            "Call this tool to get the OpenAPI spec (and usage guide) for interacting with the %s"
                + " API ",
            pluginResponse.getPlugin().getName_for_human())
        + String.format(
            "You should only call this ONCE! What is the %s API useful for? ",
            pluginResponse.getPlugin().getName_for_human())
        + pluginResponse.getPlugin().getDescription_for_human()
        + "\n"
        + "requests_get: A portal to the internet. Use this when you need to get specific content"
        + " from a website. Input should be a  url (i.e. https://www.google.com). The output will"
        + " be the text response of the GET request. \n"
        + "Use the following format:\n"
        + "\n"
        + String.format(
            "Question: the input question you must answer\n"
                + "Thought: you should always think about what to do\n"
                + "Action: the action to take, should be one of [requests_get, %s]\n"
                + "Action Input: the input to the action\n"
                + "Observation: the result of the action\n"
                + "... (this Thought/Action/Action Input/Observation can repeat N times)\n"
                + "Thought: I now know the final answer\n"
                + "Final Answer: the final answer to the original input question\n\n"
                + "Begin! And always use the openapi spec for creating the API get requests.\n",
            pluginResponse.getPlugin().getName_for_model());
  }
}
