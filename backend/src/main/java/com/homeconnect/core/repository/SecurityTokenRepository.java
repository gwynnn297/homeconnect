package com.homeconnect.core.repository;

import com.homeconnect.core.entity.SecurityToken;
import com.homeconnect.core.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SecurityTokenRepository extends JpaRepository<SecurityToken, Integer> {
    Optional<SecurityToken> findByTokenValueAndTokenTypeAndIsUsedFalse(String tokenValue, String tokenType);
    Optional<SecurityToken> findByUserAndTokenTypeAndIsUsedFalse(User user, String tokenType);
}
