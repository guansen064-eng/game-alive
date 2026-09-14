package com.alive.game.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(long sessionTtlSeconds, boolean cookieSecure) {
    public AppProperties {
        if (sessionTtlSeconds <= 0) {
            throw new IllegalArgumentException("app.session-ttl-seconds 必须大于 0");
        }
    }
}
