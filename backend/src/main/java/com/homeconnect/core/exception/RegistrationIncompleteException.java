package com.homeconnect.core.exception;

/**
 * Exception ném ra khi quy trình đăng ký của Helper chưa hoàn tất các giai đoạn bắt buộc.
 */
public class RegistrationIncompleteException extends RuntimeException {
    public RegistrationIncompleteException(String message) {
        super(message);
    }
}
