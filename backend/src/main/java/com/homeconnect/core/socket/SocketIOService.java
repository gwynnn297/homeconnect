package com.homeconnect.core.socket;

import com.corundumstudio.socketio.SocketIOServer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class SocketIOService {

    private final SocketIOServer server;

    /**
     * Gửi tin nhắn đích danh cho User dựa trên userId.
     * Mỗi user sẽ tự động join vào room mang tên "user_ID" khi connect.
     */
    public void sendMessage(String userId, String eventName, Object data) {
        String roomName = "user_" + userId;
        log.info("[Socket] Sending event {} to room {}", eventName, roomName);
        server.getRoomOperations(roomName).sendEvent(eventName, data);
    }

    /**
     * Gửi tin nhắn cho tất cả Admin.
     */
    public void sendToAdmin(String eventName, Object data) {
        log.info("[Socket] Sending event {} to admin_room", eventName);
        server.getRoomOperations("admin_room").sendEvent(eventName, data);
    }

    /**
     * Gửi tin nhắn cho tất cả mọi người.
     */
    public void broadcast(String eventName, Object data) {
        log.info("[Socket] Broadcasting event {}", eventName);
        server.getBroadcastOperations().sendEvent(eventName, data);
    }
}
