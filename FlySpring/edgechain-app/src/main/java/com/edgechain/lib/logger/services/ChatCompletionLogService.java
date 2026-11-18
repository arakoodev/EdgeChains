package com.edgechain.lib.logger.services;

import com.edgechain.lib.logger.entities.ChatCompletionLog;
import com.edgechain.lib.logger.repositories.ChatCompletionLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChatCompletionLogService {

  @Autowired private ChatCompletionLogRepository chatCompletionLogRepository;
  @Autowired private JdbcTemplate jdbcTemplate;

  public ChatCompletionLog saveOrUpdate(ChatCompletionLog chatCompletionLog) {
    this.createTable();
    return chatCompletionLogRepository.save(chatCompletionLog);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAll(Pageable pageable) {
    return this.chatCompletionLogRepository.findAll(pageable);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAllOrderByCompletedAtDesc(Pageable pageable) {
    return this.chatCompletionLogRepository.findAllByOrderByCompletedAtDesc(pageable);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAllByName(String name, Pageable pageable) {
    return this.chatCompletionLogRepository.findAllByName(name, pageable);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAllByNameOrderByCompletedAtDesc(
      String name, Pageable pageable) {
    return this.chatCompletionLogRepository.findAllByNameOrderByCompletedAtDesc(name, pageable);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAllByModel(String model, Pageable pageable) {
    return this.chatCompletionLogRepository.findAllByModel(model, pageable);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAllByModelOrderByCompletedAtDesc(
      String model, Pageable pageable) {
    return this.chatCompletionLogRepository.findAllByModelOrderByCompletedAtDesc(model, pageable);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAllByCallIdentifier(String callIdentifier, Pageable pageable) {
    return this.chatCompletionLogRepository.findAllByCallIdentifier(callIdentifier, pageable);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAllByCallIdentifierOrderByCompletedAtDesc(
      String callIdentifier, Pageable pageable) {
    return this.chatCompletionLogRepository.findAllByCallIdentifierOrderByCompletedAtDesc(
        callIdentifier, pageable);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAllByLatencyLessThanEqual(long latency, Pageable pageable) {
    return this.chatCompletionLogRepository.findAllByLatencyLessThanEqual(latency, pageable);
  }

  @Transactional(readOnly = true)
  public Page<ChatCompletionLog> findAllByLatencyGreaterThanEqual(long latency, Pageable pageable) {
    return this.chatCompletionLogRepository.findAllByLatencyGreaterThanEqual(latency, pageable);
  }

  @Transactional
  public void createTable() {
    jdbcTemplate.execute(
        "CREATE TABLE IF NOT EXISTS chat_completion_logs (\n"
            + "    chat_completion_id SERIAL PRIMARY KEY,\n"
            + "    id VARCHAR(255) NOT NULL UNIQUE,\n"
            + "    name VARCHAR(255) NOT NULL,\n"
            + "    call_identifier VARCHAR(255) NOT NULL,\n"
            + "    type VARCHAR(255) NOT NULL,\n"
            + "    created_at TIMESTAMP,\n"
            + "    completed_at TIMESTAMP,\n"
            + "    model VARCHAR(255) NOT NULL,\n"
            + "    input TEXT NOT NULL,\n"
            + "    content TEXT,\n"
            + "    presence_penalty DOUBLE PRECISION,\n"
            + "    frequency_penalty DOUBLE PRECISION,\n"
            + "    top_p DOUBLE PRECISION,\n"
            + "    n INTEGER,\n"
            + "    temperature DOUBLE PRECISION,\n"
            + "    latency BIGINT,\n"
            + "    prompt_tokens BIGINT,\n"
            + "    total_tokens BIGINT"
            + ");");
  }
}
