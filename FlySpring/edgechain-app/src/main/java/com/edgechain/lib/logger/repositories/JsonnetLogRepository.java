package com.edgechain.lib.logger.repositories;

import com.edgechain.lib.logger.entities.JsonnetLog;
import org.jetbrains.annotations.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JsonnetLogRepository extends JpaRepository<JsonnetLog, Long> {

  @Override
  @NotNull
  Page<JsonnetLog> findAll(@NotNull Pageable pageable);

  Page<JsonnetLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

  Page<JsonnetLog> findAllBySelectedFileOrderByCreatedAtDesc(String filename, Pageable pageable);
}
