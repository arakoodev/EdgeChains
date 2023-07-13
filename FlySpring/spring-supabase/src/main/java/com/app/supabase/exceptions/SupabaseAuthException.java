package com.app.supabase.exceptions;

public class SupabaseAuthException extends RuntimeException {

  public SupabaseAuthException(String message) {
    super(message);
  }
}
