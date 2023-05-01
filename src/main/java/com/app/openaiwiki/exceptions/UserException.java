package com.app.openaiwiki.exceptions;

import org.springframework.http.HttpStatus;

public class UserException extends RuntimeException{

    public UserException(String message) {
        super(message);
    }

    public UserException(HttpStatus httpStatus, String message){
        super(String.format("%s: %s", httpStatus,message));
    }

}
