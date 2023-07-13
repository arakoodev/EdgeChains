package com.app.supabase.repository;

import com.app.supabase.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {

  Optional<User> findByEmail(String email);
}
