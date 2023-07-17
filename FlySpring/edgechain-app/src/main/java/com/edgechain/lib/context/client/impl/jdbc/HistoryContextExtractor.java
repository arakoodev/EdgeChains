package com.edgechain.lib.context.client.impl.jdbc;

import com.edgechain.lib.context.domain.HistoryContext;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class HistoryContextExtractor implements ResultSetExtractor<HistoryContext> {

  @Override
  public HistoryContext extractData(ResultSet rs) throws SQLException, DataAccessException {

    HistoryContext context = new HistoryContext();
    context.setId(rs.getString(1));
    context.setResponse(rs.getString(2));

    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSSSSS");
    LocalDateTime dateTime = LocalDateTime.parse(rs.getString(3), formatter);

    context.setCreatedAt(dateTime);
    return context;
  }
}
