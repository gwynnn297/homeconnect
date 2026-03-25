package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.WebhookDepositRequest;
import com.homeconnect.core.dto.response.VietQRResponse;
import com.homeconnect.core.dto.response.WalletInfoResponse;
import com.homeconnect.core.dto.response.WalletTransactionListResponse;
import com.homeconnect.core.dto.response.WalletTransactionResponse;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.entity.Wallet;
import com.homeconnect.core.entity.WalletTransaction;
import com.homeconnect.core.enums.ReferenceType;
import com.homeconnect.core.enums.TransactionType;
import com.homeconnect.core.exception.InsufficientBalanceException;
import com.homeconnect.core.repository.WalletRepository;
import com.homeconnect.core.repository.WalletTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.UnsupportedEncodingException;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// Service quản lý ví điện tử
@Service
@RequiredArgsConstructor
@Slf4j
public class WalletService {

    private final WalletRepository walletRepository;
    private final WalletTransactionRepository transactionRepository;

    @Value("${wallet.bank.code:MB}")
    private String bankCode;

    @Value("${wallet.bank.account:0123456789}")
    private String bankAccount;

    @Value("${wallet.bank.name:NGUYEN VAN A}")
    private String bankAccountName;

    /**
     * Tạo ví mới cho user vừa đăng ký
     */
    public Wallet createWalletForUser(User user) {
        log.info("🪙 Tạo wallet cho User ID: {}", user.getId());

        Wallet wallet = Wallet.builder()
                .user(user)
                .availableBalance(BigDecimal.ZERO)
                .holdBalance(BigDecimal.ZERO)
                .debtBalance(BigDecimal.ZERO)
                .isFrozen(false)
                .build();

        return walletRepository.save(wallet);
    }

    /**
     * [BE-Wallet-02] Lấy thông tin ví của user
     */
    public WalletInfoResponse getWalletInfo(Long userId) {
        log.info("📊 Lấy thông tin ví cho User ID: {}", userId);

        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của người dùng"));

        return WalletInfoResponse.builder()
                .walletId(wallet.getWalletId())
                .userId(userId)
                .availableBalance(wallet.getAvailableBalance())
                .holdBalance(wallet.getHoldBalance())
                .debtBalance(wallet.getDebtBalance())
                .isFrozen(wallet.getIsFrozen())
                .build();
    }

    /**
     * [BE-Wallet-03] Lấy lịch sử giao dịch ví (có phân trang)
     */
    public WalletTransactionListResponse getTransactionHistory(Long userId, Pageable pageable) {
        log.info("📜 Lấy lịch sử giao dịch cho User ID: {}", userId);

        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của người dùng"));

        Page<WalletTransaction> transactionPage = transactionRepository
                .findByWallet_WalletIdOrderByCreatedAtDesc(wallet.getWalletId(), pageable);

        return WalletTransactionListResponse.builder()
                .transactions(transactionPage.getContent().stream()
                        .map(this::mapToTransactionResponse)
                        .collect(Collectors.toList()))
                .currentPage(transactionPage.getNumber())
                .totalPages(transactionPage.getTotalPages())
                .totalElements(transactionPage.getTotalElements())
                .build();
    }

    /**
     * [BE-Wallet-04] Sinh URL VietQR để Frontend hiển thị
     * Format nội dung CK: HOMIE{userId}
     */
    public VietQRResponse generateVietQRUrl(Long userId, Long amount) {
        log.info("🔗 Sinh VietQR URL cho User ID: {}, Amount: {}", userId, amount);

        String transferContent = "HOMIE" + userId;

        try {
            // VietQR API URL format
            // https://img.vietqr.io/image/{BANK_CODE}-{ACCOUNT_NUMBER}-{TEMPLATE}.png?amount={AMOUNT}&addInfo={INFO}&accountName={NAME}

            String encodedContent = URLEncoder.encode(transferContent, StandardCharsets.UTF_8.toString());
            String encodedName = URLEncoder.encode(bankAccountName, StandardCharsets.UTF_8.toString());

            String qrUrl = String.format(
                    "https://img.vietqr.io/image/%s-%s-compact.png?amount=%d&addInfo=%s&accountName=%s",
                    bankCode,
                    bankAccount,
                    amount,
                    encodedContent,
                    encodedName);

            return VietQRResponse.builder()
                    .qrCodeUrl(qrUrl)
                    .bankCode(bankCode)
                    .accountNumber(bankAccount)
                    .amount(amount)
                    .transferContent(transferContent)
                    .build();

        } catch (UnsupportedEncodingException e) {
            log.error("Lỗi encoding VietQR URL: {}", e.getMessage());
            throw new RuntimeException("Không thể tạo mã QR");
        }
    }

    /**
     * [BE-Wallet-05] Xử lý webhook deposit từ Payment Gateway (PayOS/Casso)
     * Logic: Validate -> Parse userId từ description -> Check duplicate -> Cộng
     * tiền -> Lưu lịch sử
     */
    @Transactional
    public void processWebhookDeposit(WebhookDepositRequest request) {
        log.info("💰 Xử lý webhook deposit - TransactionID: {}, Amount: {}, Description: {}",
                request.getTransactionId(), request.getAmount(), request.getDescription());

        // 1. Validate webhook signature (TODO: Implement based on payment gateway)
        // validateWebhookSignature(request);

        // 2. Chỉ xử lý transaction SUCCESS
        if (!"SUCCESS".equalsIgnoreCase(request.getStatus())) {
            log.warn("⚠️ Transaction không thành công, bỏ qua: {}", request.getStatus());
            return;
        }

        // 3. Parse userId từ description (format: "HOMIE123 NAP TIEN" hoặc "HOMIE123")
        Long userId = extractUserIdFromDescription(request.getDescription());
        if (userId == null) {
            log.error("❌ Không thể parse userId từ description: {}", request.getDescription());
            throw new RuntimeException("Nội dung chuyển khoản không hợp lệ");
        }

        // 4. Lấy ví của user
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của User ID: " + userId));

        // 5. Idempotency check - Kiểm tra giao dịch đã tồn tại chưa (chống duplicate)
        Integer referenceId = parseReferenceId(request.getTransactionId());
        if (transactionRepository.findByReferenceIdAndReferenceTypeWebhook(referenceId).isPresent()) {
            log.warn("⚠️ Giao dịch đã tồn tại, bỏ qua: TransactionID = {}", request.getTransactionId());
            return; // Return 200 OK nhưng không xử lý
        }

        // 6. Cộng tiền vào available_balance
        BigDecimal depositAmount = BigDecimal.valueOf(request.getAmount());
        wallet.setAvailableBalance(wallet.getAvailableBalance().add(depositAmount));
        walletRepository.save(wallet);

        log.info("✅ Đã cộng {} VNĐ vào ví của User ID: {}. Số dư mới: {}",
                depositAmount, userId, wallet.getAvailableBalance());

        // 7. Lưu lịch sử giao dịch
        WalletTransaction transaction = WalletTransaction.builder()
                .wallet(wallet)
                .amount(depositAmount)
                .type(TransactionType.DEPOSIT)
                .referenceType(ReferenceType.WEBHOOK)
                .referenceId(referenceId)
                .description("Nạp tiền qua " + request.getTransactionId())
                .build();
        transactionRepository.save(transaction);

        log.info("💾 Đã lưu lịch sử giao dịch ID: {}", transaction.getTransactionId());
    }

    /**
     * [BE-Wallet-06] Hold tiền khi User đăng tin hoặc đặt booking
     * INTERNAL SERVICE - Không phải API public
     * 
     * @param userId    User cần trừ tiền
     * @param amount    Số tiền cần hold
     * @param jobPostId ID của JobPost
     */
    @Transactional
    public void holdMoney(Long userId, BigDecimal amount, Long jobPostId) {
        log.info("🔒 Hold tiền cho User ID: {}, Amount: {}, JobPost ID: {}", userId, amount, jobPostId);

        // 1. Lock row với Pessimistic Write để tránh race condition
        Wallet wallet = walletRepository.findByUserIdWithLock(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của người dùng"));

        // 2. Validate số dư
        if (wallet.getAvailableBalance().compareTo(amount) < 0) {
            log.error("❌ Số dư không đủ. Available: {}, Required: {}", wallet.getAvailableBalance(), amount);
            throw new InsufficientBalanceException(
                    String.format("Số dư không đủ. Bạn cần %s VNĐ nhưng chỉ có %s VNĐ",
                            amount, wallet.getAvailableBalance()));
        }

        // 3. Trừ available_balance, cộng hold_balance
        wallet.setAvailableBalance(wallet.getAvailableBalance().subtract(amount));
        wallet.setHoldBalance(wallet.getHoldBalance().add(amount));
        walletRepository.save(wallet);

        log.info("✅ Đã hold {} VNĐ. Available: {}, Hold: {}",
                amount, wallet.getAvailableBalance(), wallet.getHoldBalance());

        // 4. Lưu lịch sử
        WalletTransaction transaction = WalletTransaction.builder()
                .wallet(wallet)
                .amount(amount)
                .type(TransactionType.HOLD)
                .referenceType(ReferenceType.JOB_POST)
                .referenceId(jobPostId.intValue())
                .description("Giữ tiền cho JobPost #" + jobPostId)
                .build();
        transactionRepository.save(transaction);
    }

    // ===== Helper Methods =====

    private WalletTransactionResponse mapToTransactionResponse(WalletTransaction transaction) {
        return WalletTransactionResponse.builder()
                .transactionId(transaction.getTransactionId())
                .amount(transaction.getAmount())
                .type(transaction.getType().name())
                .referenceType(transaction.getReferenceType().name())
                .referenceId(transaction.getReferenceId())
                .description(transaction.getDescription())
                .createdAt(transaction.getCreatedAt())
                .build();
    }

    /**
     * Parse userId từ description
     * Expected format: "HOMIE123" hoặc "HOMIE123 NAP TIEN"
     */
    private Long extractUserIdFromDescription(String description) {
        if (description == null || description.isEmpty()) {
            return null;
        }

        Pattern pattern = Pattern.compile("HOMIE(\\d+)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(description);

        if (matcher.find()) {
            return Long.parseLong(matcher.group(1));
        }

        return null;
    }

    /**
     * Parse referenceId từ transactionId string
     * Nếu transactionId là string, hash nó thành integer
     */
    private Integer parseReferenceId(String transactionId) {
        // Simple approach: use hashCode của string
        // Hoặc nếu transactionId là số, parse trực tiếp
        try {
            return Integer.parseInt(transactionId);
        } catch (NumberFormatException e) {
            // Nếu không parse được, dùng hashCode
            return transactionId.hashCode();
        }
    }
    /**
     * [BE-Wallet-07] Trừ tiền phạt từ ví Helper (khi hủy đơn sát giờ)
     */
    @Transactional
    public void deductPenalty(Long userId, BigDecimal amount, Long jobId, String reason) {
        log.info("💸 Trừ tiền phạt User ID: {}, Amount: {}, Job ID: {}, Reason: {}", userId, amount, jobId, reason);
        Wallet wallet = walletRepository.findByUserIdWithLock(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của người dùng"));

        // Có thể trừ vào available_balance, nếu âm thì thành nợ (debt_balance)
        wallet.setAvailableBalance(wallet.getAvailableBalance().subtract(amount));
        if (wallet.getAvailableBalance().compareTo(BigDecimal.ZERO) < 0) {
            BigDecimal debt = wallet.getAvailableBalance().abs();
            wallet.setDebtBalance(wallet.getDebtBalance().add(debt));
            wallet.setAvailableBalance(BigDecimal.ZERO);
        }
        walletRepository.save(wallet);

        WalletTransaction transaction = WalletTransaction.builder()
                .wallet(wallet)
                .amount(amount)
                .type(TransactionType.WITHDRAW) // Hoặc tạo thêm loại PENALTY
                .referenceType(ReferenceType.BOOKING)
                .referenceId(jobId.intValue())
                .description("Phạt hủy đơn #" + jobId + ": " + reason)
                .build();
        transactionRepository.save(transaction);
    }

    /**
     * [BE-Wallet-08] Cộng tiền bồi thường cho Khách hàng
     */
    @Transactional
    public void compensateCustomer(Long userId, BigDecimal amount, Long jobId) {
        log.info("🎁 Cộng tiền bồi thường User ID: {}, Amount: {}, Job ID: {}", userId, amount, jobId);
        Wallet wallet = walletRepository.findByUserIdWithLock(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của người dùng"));

        wallet.setAvailableBalance(wallet.getAvailableBalance().add(amount));
        walletRepository.save(wallet);

        WalletTransaction transaction = WalletTransaction.builder()
                .wallet(wallet)
                .amount(amount)
                .type(TransactionType.DEPOSIT)
                .referenceType(ReferenceType.BOOKING)
                .referenceId(jobId.intValue())
                .description("Bồi thường từ việc Helper hủy đơn #" + jobId)
                .build();
        transactionRepository.save(transaction);
    }

    /**
     * Hoàn tiền từ holdBalance về availableBalance (Khi hủy đơn/job post)
     */
    @Transactional
    public void refundHold(Long userId, BigDecimal amount, Long referenceId, String reason) {
        log.info("🔓 Hoàn tiền (Refund) User ID: {}, Amount: {}, Reference ID: {}, Reason: {}", 
                userId, amount, referenceId, reason);

        Wallet wallet = walletRepository.findByUserIdWithLock(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của người dùng"));

        if (wallet.getHoldBalance().compareTo(amount) < 0) {
            log.warn("⚠️ HoldBalance ({}) thấp hơn số tiền cần hoàn ({}). Sẽ hoàn tối đa số tiền đang giữ.", 
                    wallet.getHoldBalance(), amount);
            amount = wallet.getHoldBalance();
        }

        wallet.setHoldBalance(wallet.getHoldBalance().subtract(amount));
        wallet.setAvailableBalance(wallet.getAvailableBalance().add(amount));
        walletRepository.save(wallet);

        WalletTransaction transaction = WalletTransaction.builder()
                .wallet(wallet)
                .amount(amount)
                .type(TransactionType.REFUND)
                .referenceType(ReferenceType.JOB_POST)
                .referenceId(referenceId.intValue())
                .description("Hoàn tiền #" + referenceId + ": " + reason)
                .build();
        transactionRepository.save(transaction);
        
        log.info("✅ Đã hoàn {} VNĐ về ví khả dụng.", amount);
    }
}
