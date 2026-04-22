package com.homeconnect.core.repository;

import com.homeconnect.core.entity.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {
    Optional<ChatSession> findByIdAndCustomerId(Long id, Long customerId);
    List<ChatSession> findByCustomerIdAndStatusNotOrderByUpdatedAtDesc(Long customerId, String status);
}
