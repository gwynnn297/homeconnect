package com.homeconnect.core.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class RegisterInitResponse {
    private boolean success;
    private String message;
}


