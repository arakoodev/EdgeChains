package com.edgechain.lib.openai.plugin.tool;

import java.util.StringJoiner;

public class PluginTool {

  private String schema_version;
  private String name_for_model;
  private String name_for_human;
  private String description_for_model;
  private String description_for_human;

  private ApiConfig api;
  private String logo_url;
  private String contact_email;
  private String legal_info_url;

  public String getSchema_version() {
    return schema_version;
  }

  public void setSchema_version(String schema_version) {
    this.schema_version = schema_version;
  }

  public String getName_for_model() {
    return name_for_model;
  }

  public void setName_for_model(String name_for_model) {
    this.name_for_model = name_for_model;
  }

  public String getName_for_human() {
    return name_for_human;
  }

  public void setName_for_human(String name_for_human) {
    this.name_for_human = name_for_human;
  }

  public String getDescription_for_model() {
    return description_for_model;
  }

  public void setDescription_for_model(String description_for_model) {
    this.description_for_model = description_for_model;
  }

  public String getDescription_for_human() {
    return description_for_human;
  }

  public void setDescription_for_human(String description_for_human) {
    this.description_for_human = description_for_human;
  }

  public ApiConfig getApi() {
    return api;
  }

  public void setApi(ApiConfig api) {
    this.api = api;
  }

  public String getLogo_url() {
    return logo_url;
  }

  public void setLogo_url(String logo_url) {
    this.logo_url = logo_url;
  }

  public String getContact_email() {
    return contact_email;
  }

  public void setContact_email(String contact_email) {
    this.contact_email = contact_email;
  }

  public String getLegal_info_url() {
    return legal_info_url;
  }

  public void setLegal_info_url(String legal_info_url) {
    this.legal_info_url = legal_info_url;
  }

  @Override
  public String toString() {
    return new StringJoiner(", ", PluginTool.class.getSimpleName() + "[", "]")
        .add("schema_version='" + schema_version + "'")
        .add("name_for_model='" + name_for_model + "'")
        .add("name_for_human='" + name_for_human + "'")
        .add("description_for_model='" + description_for_model + "'")
        .add("description_for_human='" + description_for_human + "'")
        .add("api=" + api)
        .add("logo_url='" + logo_url + "'")
        .add("contact_email='" + contact_email + "'")
        .add("legal_info_url='" + legal_info_url + "'")
        .toString();
  }
}
