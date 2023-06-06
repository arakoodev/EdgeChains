package com.edgechain.lib.context.repository;

import com.edgechain.lib.context.HistoryContext;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RedisHistoryContextRepository extends CrudRepository<HistoryContext, String> {

}

