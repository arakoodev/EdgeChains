package com.app.supabase.exceptions;

public class SupabaseUserExistException extends RuntimeException {

  public SupabaseUserExistException(String message) {
    super(message);
  }

  public SupabaseUserExistException(String message, Throwable cause) {
    super(message, cause);
  }
}
