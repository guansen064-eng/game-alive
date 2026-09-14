package com.alive.game.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.alive.game.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class LoginRateLimiterTest {

    @Test
    void blocksTheEleventhAttemptInsideTheWindow() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.increment(anyString())).thenReturn(11L);
        LoginRateLimiter limiter = new LoginRateLimiter(redis);

        assertThatThrownBy(() -> limiter.check("127.0.0.1", "survivor"))
            .isInstanceOf(ApiException.class)
            .hasMessage("登录尝试过多，请 10 分钟后再试。");
    }
}
