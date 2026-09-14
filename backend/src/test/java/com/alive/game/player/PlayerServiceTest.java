package com.alive.game.player;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.alive.game.common.ApiException;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class PlayerServiceTest {

    private final PlayerService service = new PlayerService(mock(JdbcTemplate.class));

    @Test
    void rejectsAnythingOtherThanFourSlots() {
        PlayerService.LoadoutRequest request = new PlayerService.LoadoutRequest(List.of("pulse", "orbit"));

        assertThatThrownBy(() -> service.saveLoadout(1, request))
            .isInstanceOf(ApiException.class)
            .hasMessage("编队必须包含四个槽位。");
    }

    @Test
    void rejectsDuplicateWeapons() {
        PlayerService.LoadoutRequest request = new PlayerService.LoadoutRequest(
            Arrays.asList("pulse", "pulse", null, null)
        );

        assertThatThrownBy(() -> service.saveLoadout(1, request))
            .isInstanceOf(ApiException.class)
            .hasMessage("同一把武器不能重复装备。");
    }
}
