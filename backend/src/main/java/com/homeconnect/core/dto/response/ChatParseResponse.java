package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatParseResponse {

    private Integer categoryId;
    private Integer durationHours;
    private String workDate;
    private String startTime;

    @Builder.Default
    private List<Integer> serviceIds = List.of();

    private String addressText;

    @Builder.Default
    private Boolean needsAddressConfirmation = true;

    @Builder.Default
    private List<String> missingFields = List.of();

    private String followUpQuestion;

    @Builder.Default
    private Double confidence = 0.0;

    private String source;

    private Map<String, Object> raw;
}
