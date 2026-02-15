package com.homeconnect.core.repository;

import com.homeconnect.core.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
<<<<<<< Updated upstream
public interface UserRepository extends JpaRepository<User, Long> {
=======
public interface UserRepository extends JpaRepository<User, Integer> {
>>>>>>> Stashed changes
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    Optional<User> findByEmailOrPhone(String email, String phone);
}
