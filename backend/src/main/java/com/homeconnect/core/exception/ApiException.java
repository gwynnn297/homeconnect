
package com.homeconnect.core.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Custom Exception để ném ra các lỗi nghiệp vụ (Business Logic) kèm HTTP Status.
 */
@Getter
public class ApiException extends RuntimeException {
    private final HttpStatus status;

    public ApiException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }
}