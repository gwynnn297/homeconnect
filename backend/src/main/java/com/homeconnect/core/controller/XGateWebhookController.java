package com.homeconnect.core.controller;

import com.homeconnect.core.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.math.BigDecimal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
@Slf4j
public class XGateWebhookController {

    private final WalletService walletService;

    @Value("${xgate.webhook.secret}")
    private String webhookSecret;

    @PostMapping("/xgate")
    public ResponseEntity<String> handleXGateWebhook(
            @RequestHeader(value = "X-XGate-Signature", required = false) String signature,
            @RequestBody Map<String, Object> payload) {
        
        log.info("🔔 Nhận Webhook biến động số dư: {}", payload);

        // 1. Parse payload từ xGate/PayOS/Casso (Giả định format chung)
        String description = (String) payload.get("description");
        if (description == null) description = (String) payload.get("content");

        Object amountRaw = payload.get("amount");
        if (amountRaw == null) amountRaw = payload.get("transferAmount");
        
        BigDecimal amount = BigDecimal.ZERO;
        if (amountRaw != null) {
            try {
                amount = new BigDecimal(amountRaw.toString());
            } catch (Exception e) {
                log.warn("Lỗi parse số tiền từ webhook: {}", amountRaw);
            }
        }

        // 2. Kiểm tra nếu là giao dịch CHI RA (số tiền âm hoặc type=OUT)
        // Lưu ý: Tùy vào Provider (xGate/PayOS) mà dấu hiệu CHI RA khác nhau.
        // Ở đây ta giả định nếu content chứa "HOMIRT" thì là lệnh rút tiền.
        if (description != null && description.toUpperCase().contains("HOMIRT")) {
            walletService.processWithdrawWebhook(description, amount.abs());
        } else {
            // Luồng nạp tiền cũ (HOMIE...)
            // walletService.processWebhookDeposit(...)
        }

        return ResponseEntity.ok("OK");
    }
}
