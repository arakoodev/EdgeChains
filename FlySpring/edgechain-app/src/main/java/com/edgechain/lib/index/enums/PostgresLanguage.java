package com.edgechain.lib.index.enums;

public enum PostgresLanguage {
  SIMPLE("simple"),
  ARABIC("arabic"),
  ARMENIAN("armenian"),
  BASQUE("basque"),
  CATALAN("catalan"),
  DANISH("danish"),
  DUTCH("dutch"),
  ENGLISH("english"),
  FINNISH("finnish"),
  FRENCH("french"),
  GERMAN("german"),
  GREEK("greek"),
  HINDI("hindi"),
  HUNGARIAN("hungarian"),
  INDONESIAN("indonesian"),
  IRISH("irish"),
  ITALIAN("italian"),
  LITHUANIAN("lithuanian"),
  NEPALI("nepali"),
  NORWEGIAN("norwegian"),
  PORTUGUESE("portuguese"),
  ROMANIAN("romanian"),
  RUSSIAN("russian"),
  SERBIAN("serbian"),
  SPANISH("spanish"),
  SWEDISH("swedish"),
  TAMIL("tamil"),
  TURKISH("turkish"),
  YIDDISH("yiddish");

  private final String value;

  PostgresLanguage(String value) {
    this.value = value;
  }

  public String getValue() {
    return value;
  }
}
