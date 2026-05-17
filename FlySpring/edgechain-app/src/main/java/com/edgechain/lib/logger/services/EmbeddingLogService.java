package com.edgechain.lib.logger.services;

import com.edgechain.lib.logger.entities.EmbeddingLog;
import com.edgechain.lib.logger.repositories.EmbeddingLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmbeddingLogService {

  @Autowired private EmbeddingLogRepository embeddingLogRepository;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Transactional
  public EmbeddingLog saveOrUpdate(EmbeddingLog embeddingLog) {
    this.createTable();
    return this.embeddingLogRepository.save(embeddingLog);
  }

  @Transactional(readOnly = true)
  public Page<EmbeddingLog> findAll(Pageable pageable) {
    return this.embeddingLogRepository.findAll(pageable);
  }

  @Transactional(readOnly = true)
  public Page<EmbeddingLog> findAllOrderByCompletedAtDesc(Pageable pageable) {
    return this.embeddingLogRepository.findAllByOrderByCompletedAtDesc(pageable);
  }

  @Transactional(readOnly = true)
  public Page<EmbeddingLog> findAllByModel(String model, Pageable pageable) {
    return this.embeddingLogRepository.findAllByModel(model, pageable);
  }

  @Transactional(readOnly = true)
  public Page<EmbeddingLog> findAllByModelOrderByCompletedAtDesc(String model, Pageable pageable) {
    return this.embeddingLogRepository.findAllByModelOrderByCompletedAtDesc(model, pageable);
  }

  @Transactional(readOnly = true)
  public Page<EmbeddingLog> findAllByCallIdentifier(String callIdentifier, Pageable pageable) {
    return this.embeddingLogRepository.findAllByCallIdentifier(callIdentifier, pageable);
  }

  @Transactional(readOnly = true)
  public Page<EmbeddingLog> findAllByCallIdentifierOrderByCompletedAtDesc(
      String callIdentifier, Pageable pageable) {
    return this.embeddingLogRepository.findAllByCallIdentifierOrderByCompletedAtDesc(
        callIdentifier, pageable);
  }

  @Transactional(readOnly = true)
  public Page<EmbeddingLog> findAllByLatencyLessThanEqual(long latency, Pageable pageable) {
    return this.embeddingLogRepository.findAllByLatencyLessThanEqual(latency, pageable);
  }

  @Transactional(readOnly = true)
  public Page<EmbeddingLog> findAllByLatencyGreaterThanEqual(long latency, Pageable pageable) {
    return this.embeddingLogRepository.findAllByLatencyGreaterThanEqual(latency, pageable);
  }

  private static final String SQL_CREATE_TABLE =
      """
      CREATE TABLE IF NOT EXISTS embedding_logs (
              embedding_id SERIAL PRIMARY KEY,
              id VARCHAR(255) NOT NULL UNIQUE,
              call_identifier VARCHAR(255) NOT NULL,
              created_at TIMESTAMP,
              completed_at TIMESTAMP,
              model VARCHAR(255) NOT NULL,
              latency BIGINT,
              prompt_tokens BIGINT,
              total_tokens BIGINT
          );
              """;

  @Transactional
  public void createTable() {
    jdbcTemplate.execute(SQL_CREATE_TABLE);
  }
}
