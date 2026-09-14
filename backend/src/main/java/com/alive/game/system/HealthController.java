package com.alive.game.system;

import java.util.Map;
import java.util.Objects;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;

    public HealthController(JdbcTemplate jdbc, StringRedisTemplate redis) {
        this.jdbc = jdbc;
        this.redis = redis;
    }

    @GetMapping("/api/health")
    Map<String, String> health() {
        jdbc.queryForObject("SELECT 1", Integer.class);
        RedisConnection connection = Objects.requireNonNull(redis.getConnectionFactory()).getConnection();
        try {
            connection.ping();
        } finally {
            connection.close();
        }
        return Map.of("status", "ok", "mysql", "ok", "redis", "ok");
    }
}
