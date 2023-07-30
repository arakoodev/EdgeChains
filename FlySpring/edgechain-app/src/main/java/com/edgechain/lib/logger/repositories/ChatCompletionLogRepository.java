package com.edgechain.lib.logger.repositories;

import com.edgechain.lib.logger.entities.ChatCompletionLog;
import org.jetbrains.annotations.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatCompletionLogRepository extends JpaRepository<ChatCompletionLog, Long> {

  @Override
  Page<ChatCompletionLog> findAll(@NotNull Pageable pageable);

  Page<ChatCompletionLog> findAllByOrderByCompletedAtDesc(Pageable pageable);

  Page<ChatCompletionLog> findAllByName(String name, Pageable pageable);

  Page<ChatCompletionLog> findAllByNameOrderByCompletedAtDesc(String name, Pageable pageable);

  Page<ChatCompletionLog> findAllByModel(String model, Pageable pageable);

  Page<ChatCompletionLog> findAllByModelOrderByCompletedAtDesc(String model, Pageable pageable);

  Page<ChatCompletionLog> findAllByCallIdentifier(String callIdentifier, Pageable pageable);

  Page<ChatCompletionLog> findAllByCallIdentifierOrderByCompletedAtDesc(
      String callIdentifier, Pageable pageable);

  Page<ChatCompletionLog> findAllByLatencyLessThanEqual(long latency, Pageable pageable);

  Page<ChatCompletionLog> findAllByLatencyGreaterThanEqual(long latency, Pageable pageable);
}
