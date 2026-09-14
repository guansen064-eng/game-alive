package com.alive.game.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.alive.game.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletResponse;

class SessionServiceTest {

    @Test
    void rememberedSessionIsStoredInRedisAndUsesSecureCookieFlags() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        SessionService service = new SessionService(redis, new ObjectMapper(), new AppProperties(3600, true));
        MockHttpServletResponse response = new MockHttpServletResponse();

        service.create(response, new UserView(7, "survivor", "幸存者"), true);

        verify(values).set(anyString(), anyString(), eq(Duration.ofSeconds(3600)));
        String cookie = response.getHeader("Set-Cookie");
        assertThat(cookie)
            .contains("alive_session=")
            .contains("HttpOnly")
            .contains("Secure")
            .contains("SameSite=Lax")
            .contains("Max-Age=3600");
    }
}
