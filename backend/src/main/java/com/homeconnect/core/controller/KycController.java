package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.KycVerifyRequest;
import com.homeconnect.core.dto.response.KycVerifyResponse;
import com.homeconnect.core.service.HelperRegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/kyc")
@RequiredArgsConstructor
@Tag(name = "KYC Verification", description = "eKYC AI verification APIs")
public class KycController {

    private final HelperRegistrationService helperRegistrationService;

    @PostMapping("/verify")
    @PreAuthorize("hasRole('HELPER')")
    @Operation(summary = "Xac thuc AI va boc tach CCCD", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<KycVerifyResponse> verify(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody(required = false) KycVerifyRequest request) {

        KycVerifyRequest safeRequest = request == null ? KycVerifyRequest.builder().build() : request;
        KycVerifyResponse response = helperRegistrationService.verifyKycAndSubmit(userDetails.getUsername(), safeRequest);
        return ResponseEntity.ok(response);
    }
}
