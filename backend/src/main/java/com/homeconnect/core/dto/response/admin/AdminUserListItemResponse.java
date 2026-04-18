package com.homeconnect.core.dto.response.admin;

import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserListItemResponse {

    private Long userId;
    private String fullName;
    private String email;
    private String phone;
    private UserRole role;
    private UserStatus status;
    private String gender;
    private LocalDate dateOfBirth;
    private String avatarUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
