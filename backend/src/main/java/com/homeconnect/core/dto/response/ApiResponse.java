package com.homeconnect.core.dto.response;

import lombok.*;

import java.time.LocalDateTime;

/**
 * Cấu trúc phản hồi chuẩn của API
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {
    
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
    
    private String message;
    
    private T data;
}
