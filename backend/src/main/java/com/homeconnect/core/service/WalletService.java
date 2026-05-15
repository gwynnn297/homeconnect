package com.homeconnect.core.service;

import com.homeconnect.core.socket.SocketIOService;
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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
    private final com.homeconnect.core.repository.WithdrawRequestRepository withdrawRequestRepository;
    private final com.homeconnect.core.repository.WithdrawAuditLogRepository auditLogRepository;
    private final com.homeconnect.core.repository.UserBankAccountRepository userBankAccountRepository;
    private final NotificationService notificationService;
    private final SocketIOService socketIOService;

    @Value("${wallet.bank.code:MB}")
    private String bankCode;

    @Value("${wallet.bank.account:0123456789}")
    private String bankAccount;

    @Value("${wallet.bank.name:NGUYEN VAN A}")
    private String bankAccountName;

    @Value("${wallet.commission.rate:0.15}")
    private BigDecimal commissionRate; // Tỷ lệ hoa hồng sàn (mặc định 5%)

    /**
     * Tạo ví mới cho user vừa đăng ký
     */
    public Wallet createWalletForUser(User user) {
        log.info("Tạo wallet cho User ID: {}", user.getId());

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
        log.info("Lấy thông tin ví cho User ID: {}", userId);

        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của người dùng"));

        BigDecimal totalEarnings = transactionRepository.getTotalEarningsByWalletId(wallet.getWalletId());
        if (totalEarnings == null) totalEarnings = BigDecimal.ZERO;

        return WalletInfoResponse.builder()
                .walletId(wallet.getWalletId())
                .userId(userId)
                .availableBalance(wallet.getAvailableBalance())
                .holdBalance(wallet.getHoldBalance())
                .debtBalance(wallet.getDebtBalance())
                .isFrozen(wallet.getIsFrozen())
                .totalEarnings(totalEarnings)
                .build();
    }

    /**
     * [BE-Wallet-03] Lấy lịch sử giao dịch ví (có phân trang)
     */
    public WalletTransactionListResponse getTransactionHistory(Long userId, Pageable pageable) {
        log.info("Lịch sử giao dịch cho User ID: {}", userId);

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
        log.info("Sinh VietQR URL cho User ID: {}, Amount: {}", userId, amount);

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
        log.info("Xử lý webhook deposit - TransactionID: {}, Amount: {}, Description: {}",
                request.getTransactionId(), request.getAmount(), request.getDescription());

        // 1. Validate webhook signature
        // validateWebhookSignature(request);

        // 2. Chỉ xử lý transaction SUCCESS
        if (!"SUCCESS".equalsIgnoreCase(request.getStatus())) {
            log.warn("Transaction không thành công, bỏ qua: {}", request.getStatus());
            return;
        }

        // 3. Parse userId từ description (format: "HOMIE123 NAP TIEN" hoặc "HOMIE123")
        Long userId = extractUserIdFromDescription(request.getDescription());
        if (userId == null) {
            log.error("Không thể parse userId từ description: {}", request.getDescription());
            throw new RuntimeException("Nội dung chuyển khoản không hợp lệ");
        }

        // 4. Lấy ví của user
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của User ID: " + userId));

        // 5. Idempotency check - Kiểm tra giao dịch đã tồn tại chưa (chống duplicate)
        Integer referenceId = parseReferenceId(request.getTransactionId());
        if (transactionRepository.findByReferenceIdAndReferenceTypeWebhook(referenceId).isPresent()) {
            log.warn("Giao dịch đã tồn tại, bỏ qua: TransactionID = {}", request.getTransactionId());
            return; // Return 200 OK nhưng không xử lý
        }

        // 6. Cộng tiền vào available_balance
        BigDecimal depositAmount = BigDecimal.valueOf(request.getAmount());
        wallet.setAvailableBalance(wallet.getAvailableBalance().add(depositAmount));
        walletRepository.save(wallet);

        log.info("Đã cộng {} VNĐ vào ví của User ID: {}. Số dư mới: {}",
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

        // Real-time update
        sendSocketAfterCommit(userId);
        log.info("Đã lưu lịch sử giao dịch ID: {}", transaction.getTransactionId());
    }

    /**
     * [BE-Wallet-05B] Xử lý webhook NẠPER TIỀN (Deposit) từ xGate
     * Được gọi khi Customer chuyển tiền vào tài khoản Admin với nội dung "HOMIE{userId}"
     * Logic: Parse userId → Idempotency check → Cộng tiền → Lưu lịch sử → Thông báo
     */
    @Transactional
    public void processXGateDepositWebhook(String description, BigDecimal amount, String transactionId) {
        log.info("Xử lý webhook deposit xGate - TransactionID: {}, Amount: {}, Description: {}",
                transactionId, amount, description);

        // 1. Validate amount
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Số tiền nạp không hợp lệ: {}", amount);
            return;
        }

        // 2. Parse userId từ description (format: "HOMIE123" hoặc "HOMIE123 NAP TIEN")
        Long userId = extractUserIdFromDescription(description);
        if (userId == null) {
            log.error("Không thể parse userId từ description: {}", description);
            return; // Luôn trả về 200 OK để tránh xGate retry
        }

        // 3. Lấy ví của user
        Wallet wallet = walletRepository.findByUserId(userId).orElse(null);
        if (wallet == null) {
            log.error("Không tìm thấy ví của User ID: {}", userId);
            return;
        }

        // 4. Idempotency check - chống duplicate webhook
        Integer referenceId = parseReferenceId(transactionId);
        if (transactionRepository.findByReferenceIdAndReferenceTypeWebhook(referenceId).isPresent()) {
            log.warn("Giao dịch HOMIE đã xử lý rồi, bỏ qua. TransactionID = {}", transactionId);
            return;
        }

        // 5. Cộng tiền vào available_balance
        BigDecimal oldBalance = wallet.getAvailableBalance();
        wallet.setAvailableBalance(oldBalance.add(amount));
        walletRepository.save(wallet);

        log.info("Đã cộng {} VNĐ vào ví User ID: {}. Số dư: {} → {}",
                amount, userId, oldBalance, wallet.getAvailableBalance());

        // 6. Lưu lịch sử giao dịch
        WalletTransaction transaction = WalletTransaction.builder()
                .wallet(wallet)
                .amount(amount)
                .type(TransactionType.DEPOSIT)
                .referenceType(ReferenceType.WEBHOOK)
                .referenceId(referenceId)
                .description("Nạp tiền qua xGate #" + transactionId)
                .build();
        transactionRepository.save(transaction);

        // Real-time update
        sendSocketAfterCommit(userId);
        // 7. Gửi push notification cho Customer
        try {
            notificationService.createNotification(
                    userId,
                    "Nạp tiền thành công",
                    String.format("Bạn vừa nạp thành công %,.0f VNĐ vào ví. Số dư hiện tại: %,.0f VNĐ",
                            amount.doubleValue(), wallet.getAvailableBalance().doubleValue()),
                    "DEPOSIT_SUCCESS"
            );
        } catch (Exception e) {
            log.error("Lỗi gửi thông báo deposit cho User {}: {}", userId, e.getMessage());
        }

        log.info("Webhook deposit xử lý xong. TransactionID: {}", transactionId);
    }

    /**
     * [BE-Wallet-06] Hold tiền khi User đăng tin hoặc đặt booking
     * INTERNAL SERVICE - Không phải API public
     * 
     * @param userId      User cần trừ tiền
     * @param amount      Số tiền cần hold
     * @param jobPostId   ID của JobPost (nếu có)
     * @param referenceId ID tham chiếu khác (VD: Booking ID cho direct booking)
     */
    @Transactional
    public void holdMoney(Long userId, BigDecimal amount, Long jobPostId, Long referenceId) {
        log.info("Hold tiền cho User ID: {}, Amount: {}, JobPost ID: {}, Ref ID: {}", userId, amount, jobPostId, referenceId);

        // 1. Lock row với Pessimistic Write để tránh race condition
        Wallet wallet = walletRepository.findByUserIdWithLock(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của người dùng"));

        // 2. Validate số dư
        if (wallet.getAvailableBalance().compareTo(amount) < 0) {
            log.error("Số dư không đủ. Available: {}, Required: {}", wallet.getAvailableBalance(), amount);
            throw new InsufficientBalanceException(
                    String.format("Số dư không đủ. Bạn cần %s VNĐ nhưng chỉ có %s VNĐ",
                            amount, wallet.getAvailableBalance()));
        }

        // 3. Trừ available_balance, cộng hold_balance
        wallet.setAvailableBalance(wallet.getAvailableBalance().subtract(amount));
        wallet.setHoldBalance(wallet.getHoldBalance().add(amount));
        walletRepository.save(wallet);

        log.info("Đã hold {} VNĐ. Available: {}, Hold: {}",
                amount, wallet.getAvailableBalance(), wallet.getHoldBalance());

        // 4. Lưu lịch sử
        WalletTransaction transaction = WalletTransaction.builder()
                .wallet(wallet)
                .amount(amount)
                .type(TransactionType.HOLD)
                .referenceType(jobPostId != null ? ReferenceType.JOB_POST : ReferenceType.DIRECT_BOOKING)
                .referenceId(jobPostId != null ? jobPostId.intValue() : (referenceId != null ? referenceId.intValue() : 0))
                .description(jobPostId != null ? "Giữ tiền cho JobPost #" + jobPostId : "Giữ tiền cho đặt thợ trực tiếp #" + referenceId)
                .build();
        transactionRepository.save(transaction);

        // Real-time update
        sendSocketAfterCommit(userId);
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
        log.info("Trừ tiền phạt User ID: {}, Amount: {}, Job ID: {}, Reason: {}", userId, amount, jobId, reason);
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

        // Real-time update
        sendSocketAfterCommit(userId);
    }

    /**
     * [BE-Wallet-08] Cộng tiền bồi thường cho người dùng (Khách hoặc Thợ)
     */
    @Transactional
    public void compensateCustomer(Long userId, BigDecimal amount, Long jobId, String reason) {
        log.info("Cộng tiền bồi thường User ID: {}, Amount: {}, Job ID: {}, Reason: {}", userId, amount, jobId, reason);
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
                .description(reason)
                .build();
        transactionRepository.save(transaction);

        // Real-time update
        sendSocketAfterCommit(userId);
    }

    /**
     * Hoàn tiền từ holdBalance về availableBalance (Khi hủy đơn/job post)
     */
    @Transactional
    public void refundHold(Long userId, BigDecimal amount, Long referenceId, String reason) {
        log.info("Hoàn tiền (Refund) User ID: {}, Amount: {}, Reference ID: {}, Reason: {}", 
                userId, amount, referenceId, reason);

        Wallet wallet = walletRepository.findByUserIdWithLock(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của người dùng"));

        if (wallet.getHoldBalance().compareTo(amount) < 0) {
            log.warn("HoldBalance ({}) thấp hơn số tiền cần hoàn ({}). Sẽ hoàn tối đa số tiền đang giữ.", 
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

        // Real-time update
        sendSocketAfterCommit(userId);
        
        log.info("Đã hoàn {} VNĐ về ví khả dụng.", amount);
    }

    /**
     * Chia tiền khi xử lý tranh chấp: hoàn một phần cho khách, phần còn lại trả cho thợ.
     * @param booking Booking đang tranh chấp
     * @param refundRatio Tỷ lệ hoàn tiền cho khách (0..1)
     */
    @Transactional
    public BigDecimal resolveDisputeSplit(com.homeconnect.core.entity.Booking booking, BigDecimal refundRatio) {
        BigDecimal ratio = refundRatio != null ? refundRatio : BigDecimal.ONE;
        if (ratio.compareTo(BigDecimal.ZERO) < 0 || ratio.compareTo(BigDecimal.ONE) > 0) {
            throw new RuntimeException("Refund ratio không hợp lệ");
        }

        BigDecimal totalPrice = booking.getTotalPrice();
        Long customerId = booking.getCustomer().getId();
        Long helperId = booking.getHelper().getId();
        Long bookingId = booking.getId();

        Wallet customerWallet = walletRepository.findByUserIdWithLock(customerId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của khách hàng ID: " + customerId));

        if (customerWallet.getHoldBalance().compareTo(totalPrice) < 0) {
            totalPrice = customerWallet.getHoldBalance();
        }

        BigDecimal refundAmount = totalPrice.multiply(ratio).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal releaseAmount = totalPrice.subtract(refundAmount).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal commission = releaseAmount.multiply(commissionRate).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal helperSalary = releaseAmount.subtract(commission).setScale(2, java.math.RoundingMode.HALF_UP);

        customerWallet.setHoldBalance(customerWallet.getHoldBalance().subtract(totalPrice));
        customerWallet.setAvailableBalance(customerWallet.getAvailableBalance().add(refundAmount));
        walletRepository.save(customerWallet);

        if (refundAmount.compareTo(BigDecimal.ZERO) > 0) {
            WalletTransaction refundTx = WalletTransaction.builder()
                    .wallet(customerWallet)
                    .amount(refundAmount)
                    .type(TransactionType.REFUND)
                    .referenceType(ReferenceType.BOOKING)
                    .referenceId(bookingId.intValue())
                    .description("Hoàn tiền khiếu nại #" + bookingId + " (" + ratio + ")")
                    .build();
            transactionRepository.save(refundTx);
        }

        if (releaseAmount.compareTo(BigDecimal.ZERO) > 0) {
                WalletTransaction paymentTx = WalletTransaction.builder()
                    .wallet(customerWallet)
                    .amount(commission)
                    .type(TransactionType.PAYMENT)
                    .referenceType(ReferenceType.BOOKING)
                    .referenceId(bookingId.intValue())
                    .description(String.format("Thanh toán Booking #%d", bookingId))
                    .build();
            transactionRepository.save(paymentTx);

            Wallet helperWallet = walletRepository.findByUserIdWithLock(helperId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của helper ID: " + helperId));

            helperWallet.setAvailableBalance(helperWallet.getAvailableBalance().add(helperSalary));
            walletRepository.save(helperWallet);

            WalletTransaction releaseTx = WalletTransaction.builder()
                    .wallet(helperWallet)
                    .amount(helperSalary)
                    .type(TransactionType.RELEASE)
                    .referenceType(ReferenceType.BOOKING)
                    .referenceId(bookingId.intValue())
                    .description(String.format("Booking #%d (Giải ngân khiếu nại)", bookingId))
                    .build();
            transactionRepository.save(releaseTx);

            // Real-time update for Helper
            sendSocketAfterCommit(helperId);
        }

        // Real-time update for Customer (refund or final payment)
        sendSocketAfterCommit(customerId);

        return refundAmount;
    }

    /**
     * [BE-Wallet-03 Cronjob] Giải phóng lương cho Helper sau khi booking hoàn thành.
     * Logic:
     * 1. Tính commission = totalPrice * commissionRate
     * 2. Trừ totalPrice khỏi hold_balance ví Khách
     * 3. Cộng (totalPrice - commission) vào available_balance ví Thợ
     * 4. Ghi 2 transaction: COMMISSION (khách) và RELEASE (thợ)
     *
     * @param booking   Booking đã COMPLETED
     * @return helperSalary Số tiền thực nhận của Helper
     */
    @Transactional
    public BigDecimal releaseSalary(com.homeconnect.core.entity.Booking booking) {
        BigDecimal customerFinalPrice = booking.getFinalPrice() != null && booking.getFinalPrice().compareTo(BigDecimal.ZERO) > 0
                ? booking.getFinalPrice()
                : booking.getTotalPrice();
        BigDecimal originalPrice = booking.getOriginalPrice() != null && booking.getOriginalPrice().compareTo(BigDecimal.ZERO) > 0
                ? booking.getOriginalPrice()
                : booking.getTotalPrice();
        BigDecimal discountAmount = booking.getDiscountAmount() != null ? booking.getDiscountAmount() : BigDecimal.ZERO;
        Long customerId = booking.getCustomer().getId();
        Long helperId = booking.getHelper().getId();
        Long bookingId = booking.getId();

        log.info("Release salary cho Booking #{}: finalPrice={}, originalPrice={}, customer={}, helper={}",
                bookingId, customerFinalPrice, originalPrice, customerId, helperId);

        // 1. Tính commission từ original price để bảo toàn lương helper
        BigDecimal commission = originalPrice.multiply(commissionRate)
                .setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal helperSalary = originalPrice.subtract(commission);
        BigDecimal netPlatformRevenue = commission.subtract(discountAmount);

        log.info("Commission: {} ({}%), Discount subsidy: {}, Net platform revenue: {}, Helper nhận: {}",
                commission,
                commissionRate.multiply(BigDecimal.valueOf(100)),
                discountAmount,
                netPlatformRevenue,
                helperSalary);

        // 2. Trừ hold_balance ví Khách
        Wallet customerWallet = walletRepository.findByUserIdWithLock(customerId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của khách hàng ID: " + customerId));

        if (customerWallet.getHoldBalance().compareTo(customerFinalPrice) < 0) {
            log.warn("Hold balance ({}) < finalPrice ({}). Trừ tối đa hold balance.",
                    customerWallet.getHoldBalance(), customerFinalPrice);
            customerFinalPrice = customerWallet.getHoldBalance();
        }

        customerWallet.setHoldBalance(customerWallet.getHoldBalance().subtract(customerFinalPrice));
        walletRepository.save(customerWallet);

        // Ghi transaction PAYMENT cho ví Khách
        WalletTransaction paymentTx = WalletTransaction.builder()
                .wallet(customerWallet)
                .amount(customerFinalPrice)
                .type(TransactionType.PAYMENT)
                .referenceType(ReferenceType.BOOKING)
                .referenceId(bookingId.intValue())
                .description(String.format("Thanh toán Booking #%d", bookingId))
                .build();
        transactionRepository.save(paymentTx);

        // 3. Cộng available_balance ví Helper
        Wallet helperWallet = walletRepository.findByUserIdWithLock(helperId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví của thợ ID: " + helperId));

        helperWallet.setAvailableBalance(helperWallet.getAvailableBalance().add(helperSalary));
        walletRepository.save(helperWallet);

        // Ghi transaction RELEASE cho ví Helper
        WalletTransaction releaseTx = WalletTransaction.builder()
                .wallet(helperWallet)
                .amount(helperSalary)
                .type(TransactionType.RELEASE)
                .referenceType(ReferenceType.BOOKING)
                .referenceId(bookingId.intValue())
                .description(String.format("Nhận lương Booking #%d (Sau hoa hồng %s%%)", 
                 bookingId, commissionRate.multiply(BigDecimal.valueOf(100))))
                .build();
        transactionRepository.save(releaseTx);

        // [BE-Wallet-03c] Gửi thông báo giao dịch cho Helper
        try {
            notificationService.createNotification(helperId,
                    "Bạn đã nhận được thù lao! ",
                    String.format("Bạn vừa nhận được thù lao cho Booking #%d. Tổng: %,.0f VNĐ (Đã trừ %,.0f VNĐ phí hệ thống %.0f%%).",
                            bookingId, originalPrice.doubleValue(), commission.doubleValue(), commissionRate.multiply(BigDecimal.valueOf(100)).doubleValue()),
                    "WALLET_RELEASE");
        } catch (Exception e) {
            log.error("Lỗi gửi thông báo giải ngân cho Helper {}: {}", helperId, e.getMessage());
        }

        if (discountAmount.compareTo(BigDecimal.ZERO) > 0) {
            WalletTransaction subsidyTx = WalletTransaction.builder()
                    .wallet(customerWallet)
                    .amount(discountAmount)
                    .type(TransactionType.REFUND)
                    .referenceType(ReferenceType.BOOKING)
                    .referenceId(bookingId.intValue())
                    .description(String.format("Hoàn tiền giảm giá Loyalty cho Booking #%d", bookingId))
                    .build();
            transactionRepository.save(subsidyTx);
        }

        log.info("Đã release {} VNĐ cho Helper ID: {}. Commission: {} VNĐ",
                helperSalary, helperId, commission);

        // Real-time update for both
        sendSocketAfterCommit(customerId);
        sendSocketAfterCommit(helperId);

        return helperSalary;
    }

    /**
     * Getter cho commission rate (dùng bởi WalletScheduler để log)
     */
    /**
     * [PB-18 Stage 1] User yêu cầu rút tiền
     */
    @Transactional
    public void requestWithdraw(Long userId, BigDecimal amount, Integer bankAccountId) {
        log.info("User {} yêu cầu rút {} VNĐ. BankAccountID: {}", userId, amount, bankAccountId != null ? bankAccountId : "DEFAULT");
        
        // 1. Lock wallet
        Wallet wallet = walletRepository.findByUserIdWithLock(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy ví"));

        // 2. Lấy thông tin Bank linked
        com.homeconnect.core.entity.UserBankAccount bankAccount;
        if (bankAccountId != null) {
            bankAccount = userBankAccountRepository.findById(bankAccountId)
                    .orElseThrow(() -> new RuntimeException("Tài khoản ngân hàng không tồn tại"));
            
            if (!bankAccount.getUser().getId().equals(userId)) {
                throw new RuntimeException("Tài khoản ngân hàng này không thuộc về bạn");
            }
        } else {
            // Nếu không gửi ID, tìm thẻ mặc định
            bankAccount = userBankAccountRepository.findByUserIdAndIsDefaultTrue(userId)
                    .orElseThrow(() -> new RuntimeException("Vui lòng chọn hoặc liên kết một tài khoản ngân hàng mặc định để rút tiền"));
            log.info("Sử dụng tài khoản mặc định ID: {} cho User {}", bankAccount.getBankAccountId(), userId);
        }

        // 3. Validate balance and minimum amount
        if (amount.compareTo(new BigDecimal("3000")) < 0) {
            throw new RuntimeException("Số tiền rút tối thiểu là 3.000 VNĐ");
        }
        if (wallet.getAvailableBalance().compareTo(amount) < 0) {
            throw new RuntimeException("Số dư không đủ để rút tiền");
        }

        // 4. Trừ Available, Cộng Hold
        wallet.setAvailableBalance(wallet.getAvailableBalance().subtract(amount));
        wallet.setHoldBalance(wallet.getHoldBalance().add(amount));
        walletRepository.save(wallet);

        // 5. Tạo request với Snapshot thông tin bank (Quan trọng!)
        com.homeconnect.core.entity.WithdrawRequest request = com.homeconnect.core.entity.WithdrawRequest.builder()
                .wallet(wallet)
                .bankAccountRef(bankAccount)
                .amount(amount)
                .bankName(bankAccount.getBankName())
                .bankAccount(bankAccount.getAccountNumber())
                .accountHolderName(bankAccount.getAccountHolderName())
                .status(com.homeconnect.core.enums.WithdrawStatus.PENDING)
                .adminNote("Yêu cầu rút tiền tự động")
                .build();
        withdrawRequestRepository.save(request);

        // 6. Ghi lịch sử giao dịch loại HOLD để user thấy trong lịch sử
        WalletTransaction holdTx = WalletTransaction.builder()
                .wallet(wallet)
                .amount(amount)
                .type(TransactionType.HOLD)
                .referenceType(ReferenceType.WITHDRAWAL)
                .referenceId(request.getRequestId())
                .description(String.format("Đang giữ tiền cho yêu cầu rút #%d về %s - %s",
                        request.getRequestId(), bankAccount.getBankName(), bankAccount.getAccountNumber()))
                .build();
        transactionRepository.save(holdTx);

        // Real-time update
        sendSocketAfterCommit(userId);
        
        // Real-time cho Admin
        socketIOService.sendToAdmin("withdraw:new_request", request.getRequestId());

        saveAudit(request.getRequestId(), "REQUEST", "USER", "Khởi tạo yêu cầu rút tiền về " + bankAccount.getBankName());
        
        try {
            notificationService.createNotification(userId,
                    "Yêu cầu rút tiền đang chờ duyệt",
                    String.format("Yêu cầu rút %,.0f VNĐ về %s đã được gửi và đang chờ Admin duyệt.", amount.doubleValue(), bankAccount.getBankName()),
                    "WITHDRAW_PENDING");
        } catch (Exception e) {
            log.error("Failed to send notification for withdraw request: {}", e.getMessage());
        }
    }

    /**
     * [PB-18 Stage 2] Admin duyệt lệnh rút
     */
    @Transactional
    public String approveWithdraw(Integer requestId, String adminActor) {
        com.homeconnect.core.entity.WithdrawRequest request = withdrawRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu"));

        if (request.getStatus() == com.homeconnect.core.enums.WithdrawStatus.COMPLETED) {
            // Nếu đã hoàn thành rồi thì trả về mã nội dung luôn, coi như thành công im lặng
            return "HOMIRT" + requestId;
        }
        
        if (request.getStatus() != com.homeconnect.core.enums.WithdrawStatus.PENDING) {
            throw new RuntimeException("Yêu cầu không còn ở trạng thái chờ duyệt.");
        }

        // 1. Chuyển sang PROCESSING
        request.setStatus(com.homeconnect.core.enums.WithdrawStatus.PROCESSING);
        
        // 2. Sinh mã nội dung chuyển khoản để Admin copy (VD: HOMIRT123)
        String transferCode = "HOMIRT" + requestId;
        request.setAdminNote("Vui lòng CK với nội dung: " + transferCode);
        
        withdrawRequestRepository.save(request);
        saveAudit(requestId, "APPROVE", adminActor, "Admin duyệt lệnh. Chờ Admin chuyển tiền tay với nội dung: " + transferCode);
        
        // Real-time update cho User thấy đơn đã chuyển sang PROCESSING
        sendSocketAfterCommit(request.getWallet().getUser().getId());
        
        return transferCode;
    }

    @Transactional
    public void processWithdrawWebhook(String description, BigDecimal amount) {
        log.info("Khớp lệnh rút tiền từ biến động số dư: Content='{}', Amount={}", description, amount);
        
        // 1. Parse requestId từ nội dung (HOMIRT123 -> 123)
        Integer requestId = extractRequestIdFromContent(description);
        if (requestId == null) return;

        com.homeconnect.core.entity.WithdrawRequest request = withdrawRequestRepository.findById(requestId)
                .orElse(null);

        if (request == null || request.getStatus() == com.homeconnect.core.enums.WithdrawStatus.COMPLETED) {
            return;
        }

        // 2. Khớp số tiền - BẮT BUỘC phải khớp hoàn toàn để đảm bảo an toàn
        if (amount == null || request.getAmount().compareTo(amount) != 0) {
            log.error("Không thể khớp lệnh rút tiền #{}: Số tiền không khớp (Cần: {}, Nhận: {})", 
                    requestId, request.getAmount(), amount);
            saveAudit(requestId, "WEBHOOK_MISMATCH", "SYSTEM", 
                    String.format("Số tiền không khớp. Cần: %s, Nhận từ ngân hàng: %s", request.getAmount(), amount));
            return; // KHÔNG xử lý tiếp nếu tiền không khớp
        }

        // 3. Hoàn tất: trừ Hold Balance
        request.setStatus(com.homeconnect.core.enums.WithdrawStatus.COMPLETED);
        
        Wallet wallet = request.getWallet();
        wallet.setHoldBalance(wallet.getHoldBalance().subtract(request.getAmount()));
        walletRepository.save(wallet);

        // Real-time update
        sendSocketAfterCommit(wallet.getUser().getId());

        // 4. Ghi lịch sử giao dịch loại WITHDRAWAL
        WalletTransaction withdrawTx = WalletTransaction.builder()
                .wallet(wallet)
                .amount(request.getAmount())
                .type(TransactionType.WITHDRAW)
                .referenceType(ReferenceType.WITHDRAWAL)
                .referenceId(requestId)
                .description(String.format("Rút tiền thành công cho yêu cầu #%d về %s - %s",
                        requestId, request.getBankName(), request.getBankAccount()))
                .build();
        transactionRepository.save(withdrawTx);

        saveAudit(requestId, "WEBHOOK_MATCH", "SYSTEM", "Đã khớp giao dịch chi ra từ ngân hàng: " + description);
        withdrawRequestRepository.save(request);
        
        try {
            notificationService.createNotification(wallet.getUser().getId(), 
                    "Rút tiền thành công", 
                    String.format("Yêu cầu rút %,.0f VNĐ về %s đã được thực hiện thành công.", request.getAmount().doubleValue(), request.getBankName()),
                    "WITHDRAW_SUCCESS");
        } catch (Exception e) {
            log.error("Failed to send notification for withdrawal #{}: {}", requestId, e.getMessage());
        }
        log.info("Đối soát thành công đơn rút tiền #{}", requestId);
    }

    /**
     * [Admin] Lấy danh sách yêu cầu rút tiền theo trạng thái
     */
    @Transactional(readOnly = true)
    public com.homeconnect.core.dto.response.WithdrawRequestListResponse getWithdrawals(com.homeconnect.core.enums.WithdrawStatus status, org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Page<com.homeconnect.core.entity.WithdrawRequest> page;
        if (status != null) {
            page = withdrawRequestRepository.findByStatus(status, pageable);
        } else {
            page = withdrawRequestRepository.findAll(pageable);
        }
        
        java.util.List<com.homeconnect.core.dto.response.WithdrawRequestResponse> list = page.getContent().stream()
                .map(this::mapToWithdrawResponse)
                .collect(java.util.stream.Collectors.toList());

        return com.homeconnect.core.dto.response.WithdrawRequestListResponse.builder()
                .withdrawals(list)
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }

    /**
     * [Admin] Lấy chi tiết yêu cầu rút tiền
     */
    @Transactional(readOnly = true)
    public com.homeconnect.core.dto.response.WithdrawRequestResponse getWithdrawDetail(Integer requestId) {
        com.homeconnect.core.entity.WithdrawRequest req = withdrawRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu rút tiền"));
        
        return mapToWithdrawResponse(req);
    }

    /**
     * [User] Lấy danh sách yêu cầu rút tiền của mình
     */
    @Transactional(readOnly = true)
    public com.homeconnect.core.dto.response.WithdrawRequestListResponse getMyWithdrawals(Long userId, org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Page<com.homeconnect.core.entity.WithdrawRequest> page = withdrawRequestRepository.findByWalletUserId(userId, pageable);
        
        java.util.List<com.homeconnect.core.dto.response.WithdrawRequestResponse> list = page.getContent().stream()
                .map(this::mapToWithdrawResponse)
                .collect(java.util.stream.Collectors.toList());

        return com.homeconnect.core.dto.response.WithdrawRequestListResponse.builder()
                .withdrawals(list)
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .build();
    }

    /**
     * [User] Lấy chi tiết một đơn rút tiền của mình
     */
    @Transactional(readOnly = true)
    public com.homeconnect.core.dto.response.WithdrawRequestResponse getMyWithdrawDetail(Long userId, Integer requestId) {
        com.homeconnect.core.entity.WithdrawRequest req = withdrawRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu rút tiền"));
        
        if (!req.getWallet().getUser().getId().equals(userId)) {
            throw new RuntimeException("Bạn không có quyền xem yêu cầu này");
        }
        
        return mapToWithdrawResponse(req);
    }

    /**
     * [Admin] Từ chối yêu cầu rút tiền
     */
    @Transactional
    public void rejectWithdraw(Integer requestId, String reason, String adminEmail) {
        com.homeconnect.core.entity.WithdrawRequest request = withdrawRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu rút tiền"));

        if (request.getStatus() != com.homeconnect.core.enums.WithdrawStatus.PENDING 
            && request.getStatus() != com.homeconnect.core.enums.WithdrawStatus.PROCESSING) {
            throw new RuntimeException("Chỉ có thể từ chối đơn ở trạng thái PENDING hoặc PROCESSING");
        }

        // 1. Hoàn tiền về Available Balance
        Wallet wallet = request.getWallet();
        BigDecimal amount = request.getAmount();
        
        wallet.setHoldBalance(wallet.getHoldBalance().subtract(amount));
        wallet.setAvailableBalance(wallet.getAvailableBalance().add(amount));
        walletRepository.save(wallet);

        // 2. Cập nhật trạng thái đơn
        request.setStatus(com.homeconnect.core.enums.WithdrawStatus.REJECTED);
        request.setFailureReason(reason);
        withdrawRequestRepository.save(request);

        // 3. Ghi log audit
        saveAudit(requestId, "REJECT", adminEmail, "Từ chối rút tiền: " + reason);

        // 4. Cập nhật lịch sử giao dịch: Tìm transaction HOLD cũ để đánh dấu, và thêm bản ghi REFUND
        try {
            java.util.List<com.homeconnect.core.entity.WalletTransaction> holdTxs = transactionRepository.findByWallet_WalletIdAndReferenceTypeAndReferenceId(
                    wallet.getWalletId(), com.homeconnect.core.enums.ReferenceType.WITHDRAWAL, requestId);
            
            for (com.homeconnect.core.entity.WalletTransaction tx : holdTxs) {
                if (tx.getType() == com.homeconnect.core.enums.TransactionType.HOLD) {
                    tx.setDescription(tx.getDescription().replace("Đang giữ tiền", "BỊ TỪ CHỐI"));
                    transactionRepository.save(tx);
                }
            }

            com.homeconnect.core.entity.WalletTransaction refundTx = com.homeconnect.core.entity.WalletTransaction.builder()
                    .wallet(wallet)
                    .amount(amount)
                    .type(com.homeconnect.core.enums.TransactionType.REFUND)
                    .referenceType(com.homeconnect.core.enums.ReferenceType.WITHDRAWAL)
                    .referenceId(requestId)
                    .description(String.format("Hoàn tiền yêu cầu #%d bị từ chối. Lý do: %s", requestId, reason))
                    .build();
            transactionRepository.save(refundTx);
        } catch (Exception e) {
            log.warn("Could not update transaction history for rejection: {}", e.getMessage());
        }

        // 5. Thông báo cho User
        try {
            // Real-time update số dư sau khi hoàn tiền
            sendSocketAfterCommit(wallet.getUser().getId());

            notificationService.createNotification(wallet.getUser().getId(), 
                    "Yêu cầu rút tiền bị từ chối", 
                    String.format("Yêu cầu rút %,.0f VNĐ của bạn đã bị từ chối. Lý do: %s", amount.doubleValue(), reason), 
                    "WITHDRAW_REJECTED");
        } catch (Exception e) {
            log.error("Failed to send rejection notification: {}", e.getMessage());
        }
    }

    private Integer extractRequestIdFromContent(String content) {
        if (content == null) return null;
        Pattern pattern = Pattern.compile("HOMIRT\\s*(\\d+)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(content);
        if (matcher.find()) {
            return Integer.parseInt(matcher.group(1));
        }
        return null;
    }

    private void saveAudit(Integer requestId, String action, String actor, String note) {
        com.homeconnect.core.entity.WithdrawAuditLog log = com.homeconnect.core.entity.WithdrawAuditLog.builder()
                .requestId(requestId)
                .action(action)
                .actor(actor)
                .note(note)
                .build();
        auditLogRepository.save(log);
    }

    private com.homeconnect.core.dto.response.WithdrawRequestResponse mapToWithdrawResponse(com.homeconnect.core.entity.WithdrawRequest req) {
        return com.homeconnect.core.dto.response.WithdrawRequestResponse.builder()
                .requestId(req.getRequestId())
                .userId(req.getWallet().getUser().getId())
                .userFullName(req.getWallet().getUser().getFullName())
                .amount(req.getAmount())
                .bankName(req.getBankName())
                .bankAccount(req.getBankAccount())
                .accountHolderName(req.getAccountHolderName())
                .status(req.getStatus())
                .adminNote(req.getAdminNote())
                .failureReason(req.getFailureReason())
                .qrCode(generateWithdrawQRUrl(req))
                .createdAt(req.getCreatedAt())
                .build();
    }

    private String generateWithdrawQRUrl(com.homeconnect.core.entity.WithdrawRequest request) {
        if (request.getBankAccountRef() == null) {
            return null;
        }
        
        String bankCode = request.getBankAccountRef().getBankCode();
        String accountNumber = request.getBankAccount();
        BigDecimal amount = request.getAmount();
        String transferContent = "HOMIRT" + request.getRequestId();
        String accountHolderName = request.getAccountHolderName();

        try {
            String encodedContent = java.net.URLEncoder.encode(transferContent, java.nio.charset.StandardCharsets.UTF_8.toString());
            String encodedName = java.net.URLEncoder.encode(accountHolderName, java.nio.charset.StandardCharsets.UTF_8.toString());

            return String.format(
                    "https://img.vietqr.io/image/%s-%s-compact.png?amount=%d&addInfo=%s&accountName=%s",
                    bankCode,
                    accountNumber,
                    amount.longValue(),
                    encodedContent,
                    encodedName);
        } catch (java.io.UnsupportedEncodingException e) {
            log.error("Lỗi tạo mã QR rút tiền: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Gửi tín hiệu Socket sau khi transaction đã commit thành công.
     */
    private void sendSocketAfterCommit(Long userId) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    log.info("[Socket] Transaction committed, sending wallet update for user {}", userId);
                    socketIOService.sendMessage(userId.toString(), "wallet:updated", getWalletInfo(userId));
                }
            });
        } else {
            socketIOService.sendMessage(userId.toString(), "wallet:updated", getWalletInfo(userId));
        }
    }
}
