package com.edgechain.lib.logger.repositories;

import com.edgechain.lib.logger.entities.EmbeddingLog;
import org.jetbrains.annotations.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmbeddingLogRepository extends JpaRepository<EmbeddingLog, Long> {

  @Override
  Page<EmbeddingLog> findAll(@NotNull Pageable pageable);

  Page<EmbeddingLog> findAllByOrderByCompletedAtDesc(Pageable pageable);

  Page<EmbeddingLog> findAllByModel(String model, Pageable pageable);

  Page<EmbeddingLog> findAllByModelOrderByCompletedAtDesc(String model, Pageable pageable);

  Page<EmbeddingLog> findAllByCallIdentifier(String callIdentifier, Pageable pageable);

  Page<EmbeddingLog> findAllByCallIdentifierOrderByCompletedAtDesc(
      String callIdentifier, Pageable pageable);

  Page<EmbeddingLog> findAllByLatencyLessThanEqual(long latency, Pageable pageable);

  Page<EmbeddingLog> findAllByLatencyGreaterThanEqual(long latency, Pageable pageable);
}
