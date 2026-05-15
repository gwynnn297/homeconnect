package com.homeconnect.core.socket;

import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.ConnectListener;
import com.corundumstudio.socketio.listener.DisconnectListener;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class SocketModule {

    private final SocketIOServer server;

    public SocketModule(SocketIOServer server) {
        this.server = server;
        server.addConnectListener(onConnected());
        server.addDisconnectListener(onDisconnected());
    }

    private ConnectListener onConnected() {
        return client -> {
            String userId = client.getHandshakeData().getSingleUrlParam("userId");
            String role = client.getHandshakeData().getSingleUrlParam("role");

            if (userId != null && !userId.isEmpty()) {
                String roomName = "user_" + userId;
                client.joinRoom(roomName);
                
                // Nếu là ADMIN, cho vào thêm room admin
                if ("ADMIN".equalsIgnoreCase(role)) {
                    client.joinRoom("admin_room");
                    log.info("[Socket] Admin connected: userId={}, joined admin_room", userId);
                }

                log.info("[Socket] Client connected: sessionId={}, userId={}, joined room={}", 
                    client.getSessionId(), userId, roomName);
            } else {
                log.warn("[Socket] Client connected without userId: sessionId={}", client.getSessionId());
            }
        };
    }

    private DisconnectListener onDisconnected() {
        return client -> {
            log.info("[Socket] Client disconnected: sessionId={}", client.getSessionId());
        };
    }
}
