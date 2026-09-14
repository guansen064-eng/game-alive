package com.alive.game.auth;

import com.alive.game.config.AppProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
public class SessionService {
    private static final String COOKIE_NAME = "alive_session";
    private static final Duration TEMPORARY_SESSION_TTL = Duration.ofHours(12);

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final AppProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public SessionService(StringRedisTemplate redis, ObjectMapper objectMapper, AppProperties properties) {
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public void create(HttpServletResponse response, UserView user, boolean remember) {
        byte[] tokenBytes = new byte[32];
        secureRandom.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        Duration ttl = remember ? Duration.ofSeconds(properties.sessionTtlSeconds()) : TEMPORARY_SESSION_TTL;
        SessionUser session = new SessionUser(user.id(), user.username(), user.displayName(), ttl.toSeconds());

        try {
            redis.opsForValue().set(key(token), objectMapper.writeValueAsString(session), ttl);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("无法创建登录会话", exception);
        }

        ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from(COOKIE_NAME, token)
            .httpOnly(true)
            .secure(properties.cookieSecure())
            .sameSite("Lax")
            .path("/");
        if (remember) cookie.maxAge(ttl);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.build().toString());
    }

    public Optional<SessionUser> current(HttpServletRequest request) {
        String token = cookieValue(request);
        if (token == null || token.isBlank()) return Optional.empty();

        String redisKey = key(token);
        String value = redis.opsForValue().get(redisKey);
        if (value == null) return Optional.empty();

        try {
            SessionUser session = objectMapper.readValue(value, SessionUser.class);
            redis.expire(redisKey, Duration.ofSeconds(session.ttlSeconds()));
            return Optional.of(session);
        } catch (JsonProcessingException exception) {
            redis.delete(redisKey);
            return Optional.empty();
        }
    }

    public void clear(HttpServletRequest request, HttpServletResponse response) {
        String token = cookieValue(request);
        if (token != null) redis.delete(key(token));
        clearCookie(response);
    }

    public void clearCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, "")
            .httpOnly(true)
            .secure(properties.cookieSecure())
            .sameSite("Lax")
            .path("/")
            .maxAge(Duration.ZERO)
            .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private String cookieValue(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (COOKIE_NAME.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    private String key(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8));
            return "session:" + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("JVM 不支持 SHA-256", exception);
        }
    }

    public record SessionUser(long userId, String username, String displayName, long ttlSeconds) {
    }
}
