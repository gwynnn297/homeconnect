package com.homeconnect.core.dto.request;

import lombok.*;
import java.time.LocalDate;
import java.util.List;

/**
 * Object chứa dữ liệu đăng ký tạm thời của Helper
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegistrationDraft {
    // Data from Stage 1
    private LocalDate dateOfBirth;
    private Integer hometownId;
    private Integer provinceId;
    private Integer districtId;
    private Integer wardId;
    private String currentAddress;
    private List<Integer> workingDistrictIds;
    private String bio;
    private Integer experienceYears;
    private List<Integer> serviceIds;

    // Data from Stage 2
    private String identityNumber;
    private String cccdFrontUrl;
    private String cccdBackUrl;
    private String selfieUrl;

    public boolean isStage1Complete() {
        return dateOfBirth != null && hometownId != null && 
               provinceId != null && districtId != null && 
               wardId != null && currentAddress != null && 
               workingDistrictIds != null && !workingDistrictIds.isEmpty() &&
               bio != null && experienceYears != null && 
               serviceIds != null && !serviceIds.isEmpty();
    }

    public boolean isStage2Complete() {
        return identityNumber != null && cccdFrontUrl != null && 
               cccdBackUrl != null && selfieUrl != null;
    }
}
