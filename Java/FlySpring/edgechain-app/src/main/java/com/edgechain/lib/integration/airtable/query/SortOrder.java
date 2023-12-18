package com.edgechain.lib.integration.airtable.query;

public enum SortOrder {
  ASC("asc"),
  DESC("desc");

  private final String value;

  SortOrder(String value) {
    this.value = value;
  }

  public String getValue() {
    return value;
  }

  public static SortOrder fromValue(String value) {
    for (SortOrder sortOrder : SortOrder.values()) {
      if (sortOrder.value.equalsIgnoreCase(value)) {
        return sortOrder;
      }
    }
    throw new IllegalArgumentException("Invalid SortOrder value: " + value);
  }
}
