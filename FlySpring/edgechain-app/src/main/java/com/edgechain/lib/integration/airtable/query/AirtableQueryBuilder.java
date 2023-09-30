package com.edgechain.lib.integration.airtable.query;

import dev.fuxing.airtable.formula.AirtableFormula;
import dev.fuxing.airtable.formula.AirtableFunction;
import dev.fuxing.airtable.formula.AirtableOperator;

import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

public class AirtableQueryBuilder {
  private String offset;
  private List<String> fields;
  private String filterByFormula;
  private int maxRecords = 100;
  private int pageSize = 100;
  private String sortField;
  private String sortDirection;
  private String view;
  private String cellFormat;
  private String timeZone;
  private String userLocale;

  public void offset(String offset) {
    this.offset = offset;
  }

  public void fields(String... fields) {
    this.fields = Arrays.asList(fields);
  }

  public void filterByFormula(String formula) {
    this.filterByFormula = formula;
  }

  public void filterByFormula(AirtableFunction function, AirtableFormula.Object... objects) {
    this.filterByFormula = function.apply(objects);
  }

  public void filterByFormula(
      AirtableOperator operator,
      AirtableFormula.Object left,
      AirtableFormula.Object right,
      AirtableFormula.Object... others) {
    this.filterByFormula = operator.apply(left, right, others);
  }

  public void maxRecords(int maxRecords) {
    this.maxRecords = maxRecords;
  }

  public void pageSize(int pageSize) {
    this.pageSize = pageSize;
  }

  public void sort(String field, String direction) {
    this.sortField = field;
    this.sortDirection = direction;
  }

  public void view(String view) {
    this.view = view;
  }

  public void cellFormat(String cellFormat) {
    this.cellFormat = cellFormat;
  }

  public void timeZone(String timeZone) {
    this.timeZone = timeZone;
  }

  public void timeZone(ZoneId zoneId) {
    this.timeZone = zoneId.getId();
  }

  public void userLocale(String userLocale) {
    this.userLocale = userLocale;
  }

  public void userLocale(Locale locale) {
    this.userLocale = locale.toLanguageTag().toLowerCase();
  }

  // Getters for QuerySpec fields
  public String getOffset() {
    return offset;
  }

  public List<String> getFields() {
    return fields;
  }

  public String getFilterByFormula() {
    return filterByFormula;
  }

  public int getMaxRecords() {
    return maxRecords;
  }

  public int getPageSize() {
    return pageSize;
  }

  public String getSortField() {
    return sortField;
  }

  public String getSortDirection() {
    return sortDirection;
  }

  public String getView() {
    return view;
  }

  public String getCellFormat() {
    return cellFormat;
  }

  public String getTimeZone() {
    return timeZone;
  }

  public String getUserLocale() {
    return userLocale;
  }
}
