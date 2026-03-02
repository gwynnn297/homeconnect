package com.homeconnect.core.dto.response.profile;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceSimpleResponse {
    private Integer id;
    private String name;
}
