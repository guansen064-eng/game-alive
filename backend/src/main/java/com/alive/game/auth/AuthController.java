package com.alive.game.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final SessionService sessionService;

    public AuthController(AuthService authService, SessionService sessionService) {
        this.authService = authService;
        this.sessionService = sessionService;
    }

    @PostMapping("/register")
    ResponseEntity<AuthResponse> register(
        @RequestBody AuthService.RegisterRequest request,
        HttpServletResponse response
    ) {
        UserView user = authService.register(request);
        sessionService.create(response, user, true);
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(user));
    }

    @PostMapping("/login")
    AuthResponse login(
        @RequestBody AuthService.LoginRequest request,
        HttpServletRequest servletRequest,
        HttpServletResponse response
    ) {
        UserView user = authService.login(request, servletRequest.getRemoteAddr());
        sessionService.create(response, user, request.remember());
        return new AuthResponse(user);
    }

    @GetMapping("/me")
    MeResponse me(HttpServletRequest request, HttpServletResponse response) {
        Optional<SessionService.SessionUser> session = sessionService.current(request);
        if (session.isEmpty()) {
            sessionService.clearCookie(response);
            return new MeResponse(false, null);
        }

        Optional<UserView> user = authService.findActiveUser(session.get().userId());
        if (user.isEmpty()) {
            sessionService.clear(request, response);
            return new MeResponse(false, null);
        }
        return new MeResponse(true, user.get());
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        sessionService.clear(request, response);
        return ResponseEntity.noContent().build();
    }

    public record AuthResponse(UserView user) {
    }

    public record MeResponse(boolean authenticated, UserView user) {
    }
}
