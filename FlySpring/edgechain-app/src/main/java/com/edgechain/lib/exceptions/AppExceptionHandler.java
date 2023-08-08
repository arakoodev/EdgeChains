package com.edgechain.lib.exceptions;

import java.util.Objects;

import com.edgechain.lib.exceptions.response.ErrorResponse;
import com.edgechain.lib.supabase.exceptions.SupabaseAuthException;
import com.edgechain.lib.supabase.exceptions.SupabaseUserExistException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class AppExceptionHandler {

  @ExceptionHandler(value = {Exception.class})
  public ResponseEntity<Object> handleException(Exception ex) {
    ErrorResponse response = new ErrorResponse(ex.getMessage());
    return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @ExceptionHandler(value = {SupabaseUserExistException.class})
  public ResponseEntity<Object> handleSupabaseUserExistException(Exception ex) {
    ErrorResponse response = new ErrorResponse(ex.getMessage());
    return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
  }

  @ExceptionHandler(value = {SupabaseAuthException.class})
  public ResponseEntity<Object> handleSupabaseAuthException(Exception ex) {
    ErrorResponse response = new ErrorResponse(ex.getMessage());
    return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
  }

  @ExceptionHandler(value = {DataIntegrityViolationException.class})
  public ResponseEntity<Object> handleDataIntegrityViolationException(
      DataIntegrityViolationException ex) {
    ErrorResponse response =
        new ErrorResponse((Objects.requireNonNull(ex.getRootCause()).getMessage()));
    return new ResponseEntity<>(response, new HttpHeaders(), HttpStatus.BAD_REQUEST);
  }
}
