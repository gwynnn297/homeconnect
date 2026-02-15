package com.homeconnect.core.security;

import com.homeconnect.core.entity.User;
import com.homeconnect.core.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        User user = userRepository.findByEmailOrPhone(identifier, identifier)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with identifier: " + identifier));

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                new ArrayList<>() // Add more authorities if needed (e.g., based on role)
        );
    }
}
