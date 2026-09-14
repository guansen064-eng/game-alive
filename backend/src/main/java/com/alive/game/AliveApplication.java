package com.alive.game;

import com.alive.game.config.AppProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class AliveApplication {

    public static void main(String[] args) {
        SpringApplication.run(AliveApplication.class, args);
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    ApplicationRunner rejectRootDatabaseUser(@Value("${spring.datasource.username}") String username) {
        return args -> {
            if ("root".equalsIgnoreCase(username)) {
                throw new IllegalStateException("MYSQL_USER 不能使用 root，请为应用配置独立数据库账号。");
            }
        };
    }
}
