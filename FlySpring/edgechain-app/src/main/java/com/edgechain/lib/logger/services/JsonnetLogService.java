package com.edgechain.lib.logger.services;

import com.edgechain.lib.logger.entities.JsonnetLog;
import com.edgechain.lib.logger.repositories.JsonnetLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JsonnetLogService {

  @Autowired private JsonnetLogRepository jsonnetLogRepository;
  @Autowired private JdbcTemplate jdbcTemplate;

  public JsonnetLog saveOrUpdate(JsonnetLog jsonnetLog) {
    this.createTable();
    return jsonnetLogRepository.save(jsonnetLog);
  }

  @Transactional(readOnly = true)
  public Page<JsonnetLog> findAll(Pageable pageable) {
    return this.jsonnetLogRepository.findAll(pageable);
  }

  @Transactional(readOnly = true)
  public Page<JsonnetLog> findAllOrderByCreatedAtDesc(Pageable pageable) {
    return this.jsonnetLogRepository.findAllByOrderByCreatedAtDesc(pageable);
  }

  @Transactional(readOnly = true)
  public Page<JsonnetLog> findAllBySelectedFileOrderByCreatedAtDesc(
      String filename, Pageable pageable) {
    return this.jsonnetLogRepository.findAllBySelectedFileOrderByCreatedAtDesc(filename, pageable);
  }

  @Transactional
  public void createTable() {
    jdbcTemplate.execute(
        "CREATE TABLE IF NOT EXISTS jsonnet_logs (\n"
            + "    jsonnet_log_id SERIAL PRIMARY KEY,\n"
            + "    id VARCHAR(255) NOT NULL UNIQUE,\n"
            + "    split_size VARCHAR(255) NOT NULL,\n"
            + "    metadata TEXT NOT NULL,\n"
            + "    content TEXT,\n"
            + "    selected_file VARCHAR(255),\n"
            + "    f1 VARCHAR(255) NOT NULL,\n"
            + "    f2 VARCHAR(255) NOT NULL,\n"
            + "    created_at TIMESTAMP\n"
            + ");\n");
  }
}
