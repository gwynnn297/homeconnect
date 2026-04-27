package com.homeconnect.core.dto.response.profile;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationResponse {
    private String name;
    private String code;
    private String provinceCode;
    private String type; // PROVINCE, DISTRICT, WARD
}
