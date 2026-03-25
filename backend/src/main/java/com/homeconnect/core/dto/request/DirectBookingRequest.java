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
    private LocalDate workDate;
    private LocalTime startTime;
    private Integer durationHours;
    private String description;
    private String addressDetail;
    private Double latitude;
    private Double longitude;
}
