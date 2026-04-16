package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.BankBindingRequest;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.entity.UserBankAccount;
import com.homeconnect.core.repository.UserBankAccountRepository;
import com.homeconnect.core.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BankBindingService {
    private final UserBankAccountRepository bankAccountRepository;
    private final UserRepository userRepository;
    private final com.homeconnect.core.repository.WithdrawRequestRepository withdrawRequestRepository;

    private static final int MAX_BANK_ACCOUNTS = 5;

    @Transactional
    public UserBankAccount bindBankAccount(Long userId, BankBindingRequest request) {
        log.info("🏦 Liên kết ngân hàng cho User {}: {} - {}", userId, request.getBankName(), request.getAccountNumber());
        
        List<UserBankAccount> existingAccounts = bankAccountRepository.findByUserId(userId);
        if (existingAccounts.size() >= MAX_BANK_ACCOUNTS) {
            throw new RuntimeException("Bạn chỉ được phép liên kết tối đa " + MAX_BANK_ACCOUNTS + " tài khoản ngân hàng.");
        }
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        // 1. Kiểm tra so khớp tên (Security Check)
        String userFullNameNormalized = normalizeName(user.getFullName());
        String bankHolderNameNormalized = normalizeName(request.getAccountHolderName());

        log.info("🔍 So khớp tên: User='{}' ({}) vs Bank='{}' ({})", 
                user.getFullName(), userFullNameNormalized, 
                request.getAccountHolderName(), bankHolderNameNormalized);

        if (!userFullNameNormalized.equals(bankHolderNameNormalized)) {
            throw new RuntimeException("Tên chủ tài khoản ngân hàng không khớp với tên của bạn trên hệ thống (" + user.getFullName() + ")");
        }

        boolean isFirstAccount = bankAccountRepository.findByUserId(userId).isEmpty();

        UserBankAccount bankAccount = UserBankAccount.builder()
                .user(user)
                .bankName(request.getBankName())
                .bankCode(request.getBankCode())
                .accountNumber(request.getAccountNumber())
                .accountHolderName(bankHolderNameNormalized)
                .qrCodeUrl(request.getQrCodeUrl())
                .isDefault(isFirstAccount) 
                .build();

        return bankAccountRepository.save(bankAccount);
    }

    private String normalizeName(String name) {
        if (name == null) return "";
        // Loại bỏ dấu tiếng Việt, chuyển sang In hoa, xóa khoảng trắng thừa
        String normalized = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD);
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        return pattern.matcher(normalized).replaceAll("")
                .replaceAll("Đ", "D").replaceAll("đ", "d")
                .toUpperCase()
                .trim()
                .replaceAll("\\s+", " ");
    }

    public List<UserBankAccount> getUserBankAccounts(Long userId) {
        return bankAccountRepository.findByUserId(userId);
    }

    @Transactional
    public void setDefaultAccount(Long userId, Integer bankAccountId) {
        log.info("⭐ Đặt tài khoản mặc định: User {}, BankID {}", userId, bankAccountId);
        
        UserBankAccount account = bankAccountRepository.findById(bankAccountId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản ngân hàng"));
        
        if (!account.getUser().getId().equals(userId)) {
            throw new RuntimeException("Tài khoản này không thuộc về bạn");
        }

        // 1. Reset tất cả về false
        bankAccountRepository.resetDefaultByUserId(userId);
        
        // 2. Set tài khoản này là true
        account.setIsDefault(true);
        bankAccountRepository.save(account);
    }

    @Transactional
    public void deleteBankAccount(Long userId, Integer bankAccountId) {
        log.info(" Xóa tài khoản ngân hàng: User {}, BankID {}", userId, bankAccountId);
        
        UserBankAccount account = bankAccountRepository.findById(bankAccountId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản ngân hàng"));
        
        if (!account.getUser().getId().equals(userId)) {
            throw new RuntimeException("Bạn không có quyền xóa tài khoản này");
        }

        boolean wasDefault = account.getIsDefault();
        
        // Check if there are any ACTIVE withdrawal requests (PENDING or PROCESSING) using this card
        List<com.homeconnect.core.entity.WithdrawRequest> activeRequests = withdrawRequestRepository.findByBankAccountRefBankAccountId(bankAccountId)
                .stream()
                .filter(req -> req.getStatus() == com.homeconnect.core.enums.WithdrawStatus.PENDING 
                            || req.getStatus() == com.homeconnect.core.enums.WithdrawStatus.PROCESSING)
                .collect(java.util.stream.Collectors.toList());
        
        if (!activeRequests.isEmpty()) {
            throw new RuntimeException("Tài khoản ngân hàng này đang có lệnh rút tiền đang được xử lý. Bạn không thể xóa tại thời điểm này.");
        }

        // 0. Gỡ bỏ liên kết trong các đơn rút tiền ĐÃ HOÀN TẤT để tránh lỗi Foreign Key
        List<com.homeconnect.core.entity.WithdrawRequest> finishedRequests = withdrawRequestRepository.findByBankAccountRefBankAccountId(bankAccountId);
        
        for (com.homeconnect.core.entity.WithdrawRequest req : finishedRequests) {
            req.setBankAccountRef(null);
            withdrawRequestRepository.save(req);
        }

        bankAccountRepository.delete(account);
        
        // Nếu thẻ bị xóa là thẻ mặc định, hãy đặt thẻ khác (nếu có) làm mặc định để User không bị "loạn"
        if (wasDefault) {
            List<UserBankAccount> remaining = bankAccountRepository.findByUserId(userId);
            if (!remaining.isEmpty()) {
                UserBankAccount newDefault = remaining.get(0);
                newDefault.setIsDefault(true);
                bankAccountRepository.save(newDefault);
                log.info("⭐ Đã tự động đặt thẻ ID: {} làm mặc định mới.", newDefault.getBankAccountId());
            }
        }
    }
}
