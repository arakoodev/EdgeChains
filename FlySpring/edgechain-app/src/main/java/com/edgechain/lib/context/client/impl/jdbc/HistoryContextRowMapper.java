package com.edgechain.lib.context.client.impl.jdbc;

import com.edgechain.lib.context.domain.HistoryContext;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class HistoryContextRowMapper implements RowMapper<HistoryContext> {

  @Override
  public HistoryContext mapRow(ResultSet rs, int rowNum) throws SQLException {

    HistoryContextExtractor extractor = new HistoryContextExtractor();
    return extractor.extractData(rs);
  }
}
