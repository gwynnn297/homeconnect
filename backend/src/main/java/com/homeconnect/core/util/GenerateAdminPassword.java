package com.homeconnect.core.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Utility class để generate BCrypt password hash cho Admin account
 * 
 * Cách chạy: ./gradlew bootRun --args="generate-admin-password"
 * Hoặc chạy trực tiếp class này trong IDE
 */
public class GenerateAdminPassword {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        String rawPassword = "Phuc!@#29072003"; // Đổi password này
        String hashedPassword = encoder.encode(rawPassword);

        System.out.println("\n========================================");
        System.out.println("ADMIN PASSWORD GENERATOR");
        System.out.println("========================================");
        System.out.println("\nRaw password: " + rawPassword);
        System.out.println("\nHashed password (BCrypt):");
        System.out.println(hashedPassword);
        System.out.println("\n========================================");
        System.out.println("SQL để tạo admin account:");
        System.out.println("========================================\n");

        String sql = String.format(
                "INSERT INTO users (full_name, phone, email, password_hash, role, status, created_at)\n" +
                        "VALUES (\n" +
                        "    'Admin HomeConnect',\n" +
                        "    '0999999999',\n" +
                        "    'admin@gmail.com',\n" +
                        "    '%s',\n" +
                        "    'ADMIN',\n" +
                        "    'ACTIVE',\n" +
                        "    NOW()\n" +
                        ");\n",
                hashedPassword);

        System.out.println(sql);
        System.out.println("========================================\n");
    }
}
