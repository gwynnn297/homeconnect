package com.homeconnect.core.service;

import com.homeconnect.core.entity.User;
import com.homeconnect.core.entity.Wallet;
import com.homeconnect.core.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

// Service quản lý ví điện tử
@Service
@RequiredArgsConstructor
@Slf4j
public class WalletService {

    private final WalletRepository walletRepository;

    /**
     * Tạo ví mới cho user vừa đăng ký
     */
    public Wallet createWalletForUser(User user) {
        log.info(" Tạo wallet cho User ID: {}", user.getId());

        Wallet wallet = Wallet.builder()
                .user(user)
                .availableBalance(BigDecimal.ZERO)
                .holdBalance(BigDecimal.ZERO)
                .debtBalance(BigDecimal.ZERO)
                .isFrozen(false)
                .build();

        return walletRepository.save(wallet);
    }
}