package com.homeconnect.core.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DirectBookingRequest {
    private Long helperId;
    private Integer categoryId;
    private java.util.List<Integer> serviceIds;
    private LocalDate workDate;
    private LocalTime startTime;
    private Integer durationHours;
    private String description;
    private Integer addressId; // Nếu chọn từ danh sách
    private String addressDetail; // Nếu tạo mới
    private String provinceId;
    private String districtId;
    private String wardId;
    private String provinceName;
    private String districtName;
    private String wardName;
    private Double latitude;
    private Double longitude;
    private Double workSize;
    private Boolean isPremium;
    private Boolean bringTools;
    private Boolean hasPets;
    private java.util.Map<String, Object> additionalData;
}
