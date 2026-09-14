package com.alive.game.auth;

import com.alive.game.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-z0-9_]{4,20}$");
    private static final List<String> STARTER_WEAPONS = List.of("pulse", "orbit", "chain", "nova", "drone");
    private static final List<String> STARTER_LOADOUT = List.of("pulse", "orbit", "chain", "nova");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final LoginRateLimiter rateLimiter;
    private final String dummyPasswordHash;

    public AuthService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, LoginRateLimiter rateLimiter) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiter = rateLimiter;
        this.dummyPasswordHash = passwordEncoder.encode("alive-dummy-password");
    }

    @Transactional
    public UserView register(RegisterRequest request) {
        Credentials credentials = validate(request.username(), request.password(), request.displayName(), true);
        String passwordHash = passwordEncoder.encode(credentials.password());

        try {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS
                );
                statement.setString(1, credentials.username());
                statement.setString(2, credentials.displayName());
                statement.setString(3, passwordHash);
                return statement;
            }, keyHolder);

            Number generatedId = keyHolder.getKey();
            if (generatedId == null) throw new IllegalStateException("创建账号后未返回用户 ID");
            long userId = generatedId.longValue();

            jdbc.update("INSERT INTO user_wallets (user_id) VALUES (?)", userId);
            jdbc.update("INSERT INTO user_progress (user_id) VALUES (?)", userId);

            String placeholders = String.join(", ", STARTER_WEAPONS.stream().map(item -> "?").toList());
            List<WeaponId> rows = jdbc.query(
                "SELECT id, code FROM weapons WHERE code IN (" + placeholders + ") AND is_active = 1",
                (resultSet, rowNumber) -> new WeaponId(resultSet.getLong("id"), resultSet.getString("code")),
                STARTER_WEAPONS.toArray()
            );
            Map<String, Long> weaponIds = new LinkedHashMap<>();
            rows.forEach(row -> weaponIds.put(row.code(), row.id()));
            if (weaponIds.size() != STARTER_WEAPONS.size()) {
                throw new IllegalStateException("初始武器配置不完整，请先执行数据库初始化脚本。");
            }

            for (String code : STARTER_WEAPONS) {
                jdbc.update("INSERT INTO user_weapons (user_id, weapon_id) VALUES (?, ?)", userId, weaponIds.get(code));
            }
            for (int index = 0; index < STARTER_LOADOUT.size(); index++) {
                String code = STARTER_LOADOUT.get(index);
                jdbc.update(
                    "INSERT INTO user_loadout_slots (user_id, slot_no, weapon_id) VALUES (?, ?, ?)",
                    userId, index + 1, weaponIds.get(code)
                );
            }
            jdbc.update(
                """
                INSERT INTO wallet_transactions
                    (user_id, currency, amount, balance_after, biz_type, biz_id, note)
                VALUES (?, 'CRYSTAL', 1280, 1280, 'REGISTER', ?, '新账号初始晶核')
                """,
                userId, "register:" + userId
            );

            return new UserView(userId, credentials.username(), credentials.displayName());
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "USERNAME_EXISTS", "这个账号已经存在，请直接登录或更换账号。");
        }
    }

    public UserView login(LoginRequest request, String ipAddress) {
        Credentials credentials = validate(request.username(), request.password(), null, false);
        String rateKey = rateLimiter.check(ipAddress == null ? "unknown" : ipAddress, credentials.username());
        Optional<UserRow> result = findUser(credentials.username());
        String hash = result.map(UserRow::passwordHash).orElse(dummyPasswordHash);
        boolean passwordMatches = passwordEncoder.matches(credentials.password(), hash);

        if (result.isEmpty() || !passwordMatches || result.get().status() != 1) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "账号或密码不正确。");
        }

        UserRow row = result.get();
        jdbc.update("UPDATE users SET last_login_at = CURRENT_TIMESTAMP(3) WHERE id = ?", row.id());
        rateLimiter.clear(rateKey);
        return new UserView(row.id(), row.username(), row.displayName());
    }

    public Optional<UserView> findActiveUser(long userId) {
        return jdbc.query(
            "SELECT id, username, display_name FROM users WHERE id = ? AND status = 1 LIMIT 1",
            (resultSet, rowNumber) -> new UserView(
                resultSet.getLong("id"),
                resultSet.getString("username"),
                resultSet.getString("display_name")
            ),
            userId
        ).stream().findFirst();
    }

    private Optional<UserRow> findUser(String username) {
        return jdbc.query(
            "SELECT id, username, display_name, password_hash, status FROM users WHERE username = ? LIMIT 1",
            (resultSet, rowNumber) -> new UserRow(
                resultSet.getLong("id"),
                resultSet.getString("username"),
                resultSet.getString("display_name"),
                resultSet.getString("password_hash"),
                resultSet.getInt("status")
            ),
            username
        ).stream().findFirst();
    }

    private Credentials validate(String rawUsername, String password, String rawDisplayName, boolean registering) {
        String username = rawUsername == null ? "" : rawUsername.trim().toLowerCase();
        String displayName = rawDisplayName == null ? "" : rawDisplayName.trim();
        String safePassword = password == null ? "" : password;

        if (!USERNAME_PATTERN.matcher(username).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "账号需要使用 4–20 位字母、数字或下划线。");
        }
        int passwordBytes = safePassword.getBytes(StandardCharsets.UTF_8).length;
        if (passwordBytes < 8 || passwordBytes > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "密码长度需要为 8–72 个字节。");
        }
        int displayLength = displayName.codePointCount(0, displayName.length());
        if (registering && (displayLength < 2 || displayLength > 32)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "显示名称需要为 2–32 个字符。");
        }
        return new Credentials(username, safePassword, displayName);
    }

    public record RegisterRequest(String username, String displayName, String password) {
    }

    public record LoginRequest(String username, String password, boolean remember) {
    }

    private record Credentials(String username, String password, String displayName) {
    }

    private record UserRow(long id, String username, String displayName, String passwordHash, int status) {
    }

    private record WeaponId(long id, String code) {
    }
}
