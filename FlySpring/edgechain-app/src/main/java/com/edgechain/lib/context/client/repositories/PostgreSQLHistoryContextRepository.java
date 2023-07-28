package com.edgechain.lib.context.client.repositories;

import com.edgechain.lib.context.domain.HistoryContext;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PostgreSQLHistoryContextRepository extends JpaRepository<HistoryContext, String> {}
