package com.alive.game.player;

import com.alive.game.auth.SessionService;
import com.alive.game.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/player")
public class PlayerController {
    private final PlayerService playerService;
    private final SessionService sessionService;

    public PlayerController(PlayerService playerService, SessionService sessionService) {
        this.playerService = playerService;
        this.sessionService = sessionService;
    }

    @GetMapping("/profile")
    PlayerService.PlayerProfile profile(HttpServletRequest request) {
        return playerService.getProfile(requireUserId(request));
    }

    @PutMapping("/loadout")
    PlayerService.LoadoutResponse saveLoadout(
        @RequestBody PlayerService.LoadoutRequest body,
        HttpServletRequest request
    ) {
        return playerService.saveLoadout(requireUserId(request), body);
    }

    private long requireUserId(HttpServletRequest request) {
        return sessionService.current(request)
            .map(SessionService.SessionUser::userId)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "请先登录账号。"));
    }
}
