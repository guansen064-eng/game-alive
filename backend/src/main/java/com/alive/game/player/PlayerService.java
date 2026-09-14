package com.alive.game.player;

import com.alive.game.auth.UserView;
import com.alive.game.common.ApiException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlayerService {
    private static final Pattern WEAPON_CODE_PATTERN = Pattern.compile("^[a-z0-9_]{1,32}$");

    private final JdbcTemplate jdbc;

    public PlayerService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public PlayerProfile getProfile(long userId) {
        Summary summary = jdbc.query(
            """
            SELECT u.id, u.username, u.display_name, w.crystal, w.gold,
                   p.account_level, p.account_exp, p.total_runs, p.total_kills,
                   p.best_score, p.max_survival_seconds
              FROM users u
              JOIN user_wallets w ON w.user_id = u.id
              JOIN user_progress p ON p.user_id = u.id
             WHERE u.id = ? AND u.status = 1
            """,
            (resultSet, rowNumber) -> new Summary(
                resultSet.getLong("id"),
                resultSet.getString("username"),
                resultSet.getString("display_name"),
                resultSet.getLong("crystal"),
                resultSet.getLong("gold"),
                resultSet.getInt("account_level"),
                resultSet.getLong("account_exp"),
                resultSet.getLong("total_runs"),
                resultSet.getLong("total_kills"),
                resultSet.getLong("best_score"),
                resultSet.getInt("max_survival_seconds")
            ),
            userId
        ).stream().findFirst().orElseThrow(() ->
            new ApiException(HttpStatus.NOT_FOUND, "PROFILE_NOT_FOUND", "没有找到玩家数据。")
        );

        List<OwnedWeapon> weapons = jdbc.query(
            """
            SELECT w.code, uw.level, uw.copies, uw.acquired_at
              FROM user_weapons uw
              JOIN weapons w ON w.id = uw.weapon_id
             WHERE uw.user_id = ? AND w.is_active = 1
             ORDER BY w.sort_order
            """,
            (resultSet, rowNumber) -> {
                Timestamp acquiredAt = resultSet.getTimestamp("acquired_at");
                return new OwnedWeapon(
                    resultSet.getString("code"),
                    resultSet.getInt("level"),
                    resultSet.getInt("copies"),
                    acquiredAt == null ? null : acquiredAt.toInstant()
                );
            },
            userId
        );

        List<String> loadout = new ArrayList<>(Collections.nCopies(4, null));
        jdbc.query(
            """
            SELECT s.slot_no, w.code
              FROM user_loadout_slots s
              JOIN weapons w ON w.id = s.weapon_id
             WHERE s.user_id = ?
             ORDER BY s.slot_no
            """,
            resultSet -> {
                int slot = resultSet.getInt("slot_no");
                if (slot >= 1 && slot <= 4) loadout.set(slot - 1, resultSet.getString("code"));
            },
            userId
        );

        return new PlayerProfile(
            new UserView(summary.id(), summary.username(), summary.displayName()),
            new Wallet(summary.crystal(), summary.gold()),
            new Progress(
                summary.accountLevel(),
                summary.accountExp(),
                summary.totalRuns(),
                summary.totalKills(),
                summary.bestScore(),
                summary.maxSurvivalSeconds()
            ),
            weapons,
            Collections.unmodifiableList(loadout)
        );
    }

    @Transactional
    public LoadoutResponse saveLoadout(long userId, LoadoutRequest request) {
        List<String> weaponCodes = request == null ? null : request.weaponCodes();
        if (weaponCodes == null || weaponCodes.size() != 4) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_LOADOUT", "编队必须包含四个槽位。");
        }

        List<String> equippedCodes = new ArrayList<>();
        for (String code : weaponCodes) {
            if (code == null) continue;
            if (!WEAPON_CODE_PATTERN.matcher(code).matches()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_LOADOUT", "编队中包含无效武器标识。");
            }
            equippedCodes.add(code);
        }
        Set<String> uniqueCodes = new HashSet<>(equippedCodes);
        if (uniqueCodes.size() != equippedCodes.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DUPLICATE_WEAPON", "同一把武器不能重复装备。");
        }

        Map<String, Long> ownedWeapons = new HashMap<>();
        if (!equippedCodes.isEmpty()) {
            String placeholders = String.join(", ", equippedCodes.stream().map(item -> "?").toList());
            Object[] arguments = new Object[equippedCodes.size() + 1];
            arguments[0] = userId;
            for (int index = 0; index < equippedCodes.size(); index++) arguments[index + 1] = equippedCodes.get(index);

            List<WeaponId> rows = jdbc.query(
                """
                SELECT w.id, w.code
                  FROM user_weapons uw
                  JOIN weapons w ON w.id = uw.weapon_id
                 WHERE uw.user_id = ? AND w.code IN (%s) AND w.is_active = 1
                """.formatted(placeholders),
                (resultSet, rowNumber) -> new WeaponId(
                    resultSet.getLong("id"),
                    resultSet.getString("code")
                ),
                arguments
            );
            rows.forEach(row -> ownedWeapons.put(row.code(), row.id()));
        }
        if (ownedWeapons.size() != equippedCodes.size()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "WEAPON_NOT_OWNED", "编队中包含尚未拥有的武器。");
        }

        jdbc.update("DELETE FROM user_loadout_slots WHERE user_id = ?", userId);
        for (int index = 0; index < weaponCodes.size(); index++) {
            String code = weaponCodes.get(index);
            if (code != null) {
                jdbc.update(
                    "INSERT INTO user_loadout_slots (user_id, slot_no, weapon_id) VALUES (?, ?, ?)",
                    userId, index + 1, ownedWeapons.get(code)
                );
            }
        }
        return new LoadoutResponse(Collections.unmodifiableList(new ArrayList<>(weaponCodes)));
    }

    public record PlayerProfile(
        UserView user,
        Wallet wallet,
        Progress progress,
        List<OwnedWeapon> weapons,
        List<String> loadout
    ) {
    }

    public record Wallet(long crystal, long gold) {
    }

    public record Progress(
        int accountLevel,
        long accountExp,
        long totalRuns,
        long totalKills,
        long bestScore,
        int maxSurvivalSeconds
    ) {
    }

    public record OwnedWeapon(String code, int level, int copies, Instant acquiredAt) {
    }

    public record LoadoutRequest(List<String> weaponCodes) {
    }

    public record LoadoutResponse(List<String> loadout) {
    }

    private record Summary(
        long id,
        String username,
        String displayName,
        long crystal,
        long gold,
        int accountLevel,
        long accountExp,
        long totalRuns,
        long totalKills,
        long bestScore,
        int maxSurvivalSeconds
    ) {
    }

    private record WeaponId(long id, String code) {
    }
}
