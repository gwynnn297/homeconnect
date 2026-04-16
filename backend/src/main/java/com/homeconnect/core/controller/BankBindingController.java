package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.BankBindingRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.entity.UserBankAccount;
import com.homeconnect.core.service.BankBindingService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/wallets/bank-accounts")
@RequiredArgsConstructor
@Tag(name = "Bank Binding", description = "API liên kết tài khoản ngân hàng để rút tiền")
public class BankBindingController {
    private final BankBindingService bankBindingService;
    private final SecurityUtil securityUtil;

    @Operation(summary = "Liên kết ngân hàng mới", description = "User thêm số tài khoản ngân hàng để làm đích rút tiền")
    @PostMapping
    public ResponseEntity<ApiResponse<UserBankAccount>> bindBank(
            @Valid @RequestBody BankBindingRequest request,
            Authentication authentication) {
        
        Long userId = securityUtil.getCurrentUserId(authentication);
        UserBankAccount account = bankBindingService.bindBankAccount(userId, request);
        
        return ResponseEntity.ok(ApiResponse.<UserBankAccount>builder()
                .message("Liên kết ngân hàng thành công!")
                .data(account)
                .build());
    }

    @Operation(summary = "Lấy danh sách ngân hàng đã liên kết")
    @GetMapping
    public ResponseEntity<ApiResponse<List<UserBankAccount>>> getMyBanks(Authentication authentication) {
        Long userId = securityUtil.getCurrentUserId(authentication);
        List<UserBankAccount> accounts = bankBindingService.getUserBankAccounts(userId);
        
        return ResponseEntity.ok(ApiResponse.<List<UserBankAccount>>builder()
                .message("Thành công")
                .data(accounts)
                .build());
    }

    @Operation(summary = "Đặt tài khoản ngân hàng mặc định", description = "User chọn 1 trong các thẻ đã liên kết làm thẻ mặc định để rút tiền")
    @PatchMapping("/{bankAccountId}/default")
    public ResponseEntity<ApiResponse<Void>> setDefault(
            @PathVariable Integer bankAccountId,
            Authentication authentication) {
        
        Long userId = securityUtil.getCurrentUserId(authentication);
        bankBindingService.setDefaultAccount(userId, bankAccountId);
        
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Đã đặt tài khoản mặc định thành công!")
                .build());
    }

    @Operation(summary = "Xóa tài khoản ngân hàng", description = "User xóa một tài khoản ngân hàng đã liên kết")
    @DeleteMapping("/{bankAccountId}")
    public ResponseEntity<ApiResponse<Void>> deleteAccount(
            @PathVariable Integer bankAccountId,
            Authentication authentication) {
        
        Long userId = securityUtil.getCurrentUserId(authentication);
        bankBindingService.deleteBankAccount(userId, bankAccountId);
        
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Đã xóa tài khoản ngân hàng thành công!")
                .build());
    }
}
