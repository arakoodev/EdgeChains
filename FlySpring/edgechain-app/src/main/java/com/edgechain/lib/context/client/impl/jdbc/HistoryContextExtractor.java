package com.edgechain.lib.context.client.impl.jdbc;

import com.edgechain.lib.context.domain.HistoryContext;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class HistoryContextExtractor implements ResultSetExtractor<HistoryContext> {

  @Override
  public HistoryContext extractData(ResultSet rs) throws SQLException, DataAccessException {

    HistoryContext context = new HistoryContext();
    context.setId(rs.getString(1));
    context.setResponse(rs.getString(2));

    Timestamp timestamp = rs.getTimestamp(3);
    context.setCreatedAt(timestamp.toLocalDateTime());
    return context;
  }
}
