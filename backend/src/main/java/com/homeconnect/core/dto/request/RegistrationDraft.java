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
    private String hometownName;
    private String provinceName;
    private String districtName;
    private String wardName;
    private String currentAddress;
    private List<com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest.WorkingDistrictRequest> workingDistricts;
    private String bio;
    private Integer experienceYears;
    private List<Integer> serviceIds;

    // Data from Stage 2
    private String identityNumber;
    private String cccdFrontUrl;
    private String cccdBackUrl;
    private String selfieUrl;

    public boolean isStage1Complete() {
        return dateOfBirth != null && hometownName != null && 
               provinceName != null && districtName != null && 
               wardName != null && currentAddress != null && 
               workingDistricts != null && !workingDistricts.isEmpty() &&
               bio != null && experienceYears != null && 
               serviceIds != null && !serviceIds.isEmpty();
    }

    public boolean isStage2Complete() {
        return identityNumber != null && cccdFrontUrl != null && 
               cccdBackUrl != null && selfieUrl != null;
    }
}
