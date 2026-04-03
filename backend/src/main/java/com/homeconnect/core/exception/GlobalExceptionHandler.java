package com.homeconnect.core.exception;

import com.homeconnect.core.dto.response.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

        @ExceptionHandler(ApiException.class)
        public ResponseEntity<ErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
                HttpStatus status = ex.getStatus() != null ? ex.getStatus() : HttpStatus.BAD_REQUEST;
                ErrorResponse error = ErrorResponse.builder()
                                .timestamp(LocalDateTime.now())
                                .status(status.value())
                                .error(status.getReasonPhrase())
                                .message(ex.getMessage())
                                .path(request.getRequestURI())
                                .build();
                return new ResponseEntity<>(error, status);
        }

        @ExceptionHandler(RuntimeException.class)
        public ResponseEntity<ErrorResponse> handleRuntimeException(RuntimeException ex, HttpServletRequest request) {
                ErrorResponse error = ErrorResponse.builder()
                                .timestamp(LocalDateTime.now())
                                .status(HttpStatus.BAD_REQUEST.value())
                                .error("Yêu cầu không hợp lệ")
                                .message(ex.getMessage())
                                .path(request.getRequestURI())
                                .build();
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(AccountBlockedException.class)
        public ResponseEntity<ErrorResponse> handleAccountBlocked(AccountBlockedException ex,
                        HttpServletRequest request) {
                ErrorResponse error = ErrorResponse.builder()
                                .timestamp(LocalDateTime.now())
                                .status(HttpStatus.FORBIDDEN.value())
                                .error("Truy cập bị từ chối")
                                .message(ex.getMessage())
                                .path(request.getRequestURI())
                                .build();
                return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
        }

        @ExceptionHandler(BadCredentialsException.class)
        public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex,
                        HttpServletRequest request) {
                ErrorResponse error = ErrorResponse.builder()
                                .timestamp(LocalDateTime.now())
                                .status(HttpStatus.UNAUTHORIZED.value())
                                .error("Không được phép")
                                .message("Email/Số điện thoại hoặc mật khẩu không đúng")
                                .path(request.getRequestURI())
                                .build();
                return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<ErrorResponse> handleValidationExceptions(MethodArgumentNotValidException ex,
                        HttpServletRequest request) {
                String message = ex.getBindingResult().getFieldErrors().stream()
                                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                                .collect(Collectors.joining(", "));

                ErrorResponse error = ErrorResponse.builder()
                                .timestamp(LocalDateTime.now())
                                .status(HttpStatus.BAD_REQUEST.value())
                                .error("Lỗi xác thực dữ liệu")
                                .message(message)
                                .path(request.getRequestURI())
                                .build();
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(RegistrationIncompleteException.class)
        public ResponseEntity<ErrorResponse> handleRegistrationIncomplete(RegistrationIncompleteException ex,
                        HttpServletRequest request) {
                ErrorResponse error = ErrorResponse.builder()
                                .timestamp(LocalDateTime.now())
                                .status(HttpStatus.BAD_REQUEST.value())
                                .error("Quy trình đăng ký chưa hoàn tất")
                                .message(ex.getMessage())
                                .path(request.getRequestURI())
                                .build();
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
        }

        @ExceptionHandler(ResourceNotFoundException.class)
        public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex,
                        HttpServletRequest request) {
                ErrorResponse error = ErrorResponse.builder()
                                .timestamp(LocalDateTime.now())
                                .status(HttpStatus.NOT_FOUND.value())
                                .error("Không tìm thấy tài nguyên")
                                .message(ex.getMessage())
                                .path(request.getRequestURI())
                                .build();
                return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
        }

        @ExceptionHandler(BadRequestException.class)
        public ResponseEntity<ErrorResponse> handleBadRequest(BadRequestException ex, HttpServletRequest request) {
                ErrorResponse error = ErrorResponse.builder()
                                .timestamp(LocalDateTime.now())
                                .status(HttpStatus.BAD_REQUEST.value())
                                .error("Yêu cầu không hợp lệ")
                                .message(ex.getMessage())
                                .path(request.getRequestURI())
                                .build();
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
        }
}
