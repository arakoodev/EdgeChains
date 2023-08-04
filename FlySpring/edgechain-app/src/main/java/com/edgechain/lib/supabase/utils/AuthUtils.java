package com.edgechain.lib.supabase.utils;

import com.edgechain.lib.request.ArkRequest;
import jakarta.servlet.http.HttpServletRequest;

public class AuthUtils {

  public static String extractToken(HttpServletRequest request) {
    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer")) return header.replace("Bearer ", "");

    return null;
  }

  public static String extractToken(ArkRequest request) {
    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer")) return header.replace("Bearer ", "");
    return null;
  }
}
