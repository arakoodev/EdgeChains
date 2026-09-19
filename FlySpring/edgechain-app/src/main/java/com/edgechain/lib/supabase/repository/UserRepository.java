package com.edgechain.lib.supabase.repository;

import com.edgechain.lib.supabase.entities.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class UserRepository {

  @Autowired private JdbcTemplate jdbcTemplate;

  public Optional<User> findByEmail(String email) {
    String sql = String.format("select * from auth.users where email='%s'", email);
    List<User> contextList = jdbcTemplate.query(sql, new BeanPropertyRowMapper<>(User.class));

    if (contextList.size() > 0) return Optional.ofNullable(contextList.get(0));
    else return Optional.empty();
  }
}
