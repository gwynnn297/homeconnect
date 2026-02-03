package com.homeconnect.core;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class HomeConnectCoreApiApplication {

	public static void main(String[] args) {
		// Load environment variables from .env file
		java.io.File envFile = new java.io.File(".env");
		if (envFile.exists()) {
			try (java.io.BufferedReader reader = java.nio.file.Files.newBufferedReader(envFile.toPath())) {
				reader.lines().forEach(line -> {
					if (line.contains("=") && !line.startsWith("#")) {
						String[] parts = line.split("=", 2);
						if (parts.length == 2) {
							System.setProperty(parts[0], parts[1]);
						}
					}
				});
			} catch (Exception e) {
				System.err.println("Error loading .env file: " + e.getMessage());
			}
		}
		
		SpringApplication.run(HomeConnectCoreApiApplication.class, args);
	}
}
