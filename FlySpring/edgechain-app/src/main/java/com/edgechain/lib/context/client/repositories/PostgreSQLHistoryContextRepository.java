package com.edgechain.lib.context.client.repositories;

import com.edgechain.lib.context.client.impl.jdbc.HistoryContextRowMapper;
import com.edgechain.lib.context.domain.HistoryContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Repository
public class PostgreSQLHistoryContextRepository {

  @Autowired private JdbcTemplate jdbcTemplate;

  @Transactional
  public void createTable() {
    jdbcTemplate.execute(
        "CREATE TABLE IF NOT EXISTS history_context (id TEXT PRIMARY KEY, response TEXT, created_at timestamp)");
  }

  @Transactional
  public void insert(HistoryContext context) {
    jdbcTemplate.execute(
        String.format(
            "INSERT INTO history_context (id, response, created_at) values ('%s','%s', '%s')",
            context.getId(), context.getResponse(), context.getCreatedAt()));
  }

  @Transactional
  public void update(HistoryContext context) {
    jdbcTemplate.execute(
        String.format(
            "INSERT INTO history_context (id, response) values ('%s','%s')\n"
                + "    ON CONFLICT (id) DO UPDATE SET response = EXCLUDED.response;",
            context.getId(), context.getResponse()));
  }

  @Transactional(readOnly = true)
  public Optional<HistoryContext> findById(String id) {
    String sql = String.format("select * from history_context where id='%s'", id);
    List<HistoryContext> contextList = jdbcTemplate.query(sql, new HistoryContextRowMapper());

    if (contextList.size() > 0) return Optional.ofNullable(contextList.get(0));
    else return Optional.empty();
  }

  @Transactional
  public void delete(String id) {
    jdbcTemplate.execute(String.format("delete from history_context where id='%s'", id));
  }
}
