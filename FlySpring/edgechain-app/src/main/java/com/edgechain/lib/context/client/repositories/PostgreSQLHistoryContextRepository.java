package com.edgechain.lib.context.client.repositories;

import com.edgechain.lib.context.client.impl.jdbc.HistoryContextRowMapper;
import com.edgechain.lib.context.domain.HistoryContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostgreSQLHistoryContextRepository extends JpaRepository<HistoryContext, String> {


}
