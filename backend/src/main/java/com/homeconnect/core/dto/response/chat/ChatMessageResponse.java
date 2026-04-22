package com.homeconnect.core.dto.response.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageResponse {
    private Long id;
    private Long sessionId;
    private String sender;
    private String messageType;
    private String content;
    private Map<String, Object> structuredData;
    private String modelName;
    private Integer tokensInput;
    private Integer tokensOutput;
    private Integer latencyMs;
    private LocalDateTime createdAt;
}
