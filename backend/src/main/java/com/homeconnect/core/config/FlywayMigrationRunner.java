package com.homeconnect.core.config;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Force Flyway Migration Runner
 * Đảm bảo migration chạy khi ứng dụng khởi động
 */
@Component
public class FlywayMigrationRunner implements ApplicationRunner {

    @Autowired
    private DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        // Force chạy Flyway migration
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .load();

        // Chạy migration
        flyway.migrate();

        System.out.println("Flyway migration completed successfully!");
    }
}