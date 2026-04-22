package com.homeconnect.core.dto.response.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatSendMessageResponse {
    private ChatSessionResponse session;
    private ChatMessageResponse userMessage;
    private ChatMessageResponse assistantMessage;
}
