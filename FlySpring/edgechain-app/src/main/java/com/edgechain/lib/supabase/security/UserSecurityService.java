package com.edgechain.lib.supabase.security;

import com.edgechain.lib.supabase.entities.User;
import com.edgechain.lib.supabase.services.UserService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserSecurityService implements UserDetailsService {

  @Autowired private UserService userService;

  @Override
  public User loadUserByUsername(String accessToken) throws UsernameNotFoundException {
    User user = new ModelMapper().map(this.userService.getUser(accessToken), User.class);
    user.setAccessToken(accessToken);
    return user;
  }
}
