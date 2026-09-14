-- ALIVE // 生存协议
-- MySQL 8.0+ 初始化脚本
--
-- 设计范围：账号、资产、武器图鉴、四槽编队、抽卡流水、局外成长、对局记录。
-- Redis 不使用 SQL 建表；建议用于登录会话、接口限流和排行榜缓存。

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE DATABASE IF NOT EXISTS `alive_game`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `alive_game`;

-- 账号。password_hash 只保存 Argon2id 或 bcrypt 生成的完整哈希，绝不保存明文密码。
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(20) NOT NULL COMMENT '登录账号，后端统一转为小写',
  `display_name` VARCHAR(32) NOT NULL COMMENT '游戏内显示名称',
  `password_hash` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '0=禁用，1=正常',
  `last_login_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  CONSTRAINT `ck_users_status` CHECK (`status` IN (0, 1)),
  CONSTRAINT `ck_users_username_length` CHECK (CHAR_LENGTH(`username`) BETWEEN 4 AND 20),
  CONSTRAINT `ck_users_display_name_length` CHECK (CHAR_LENGTH(`display_name`) BETWEEN 2 AND 32)
) ENGINE=InnoDB COMMENT='用户账号';

-- 用户货币。version 用于乐观锁，防止并发抽卡时重复扣款。
CREATE TABLE IF NOT EXISTS `user_wallets` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `crystal` BIGINT UNSIGNED NOT NULL DEFAULT 1280 COMMENT '能量晶核',
  `gold` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '金币',
  `version` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_wallets_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='用户货币余额';

-- 武器静态配置。新增武器只需新增记录，无需修改用户表。
CREATE TABLE IF NOT EXISTS `weapons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '前后端共用的稳定标识',
  `name` VARCHAR(50) NOT NULL,
  `rarity` ENUM('BASIC', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL,
  `role_name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `base_damage` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `attack_interval_ms` INT UNSIGNED NULL COMMENT '持续型武器可为 NULL',
  `is_active` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `metadata` JSON NULL COMMENT '表现层扩展字段，例如颜色 tone',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_weapons_code` (`code`),
  KEY `idx_weapons_active_sort` (`is_active`, `sort_order`),
  CONSTRAINT `ck_weapons_active` CHECK (`is_active` IN (0, 1)),
  CONSTRAINT `ck_weapons_damage` CHECK (`base_damage` >= 0)
) ENGINE=InnoDB COMMENT='武器配置';

-- 用户拥有的武器。copies 可用于重复抽取后的碎片/升星系统。
CREATE TABLE IF NOT EXISTS `user_weapons` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `weapon_id` BIGINT UNSIGNED NOT NULL,
  `level` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `copies` INT UNSIGNED NOT NULL DEFAULT 1,
  `acquired_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`, `weapon_id`),
  KEY `idx_user_weapons_weapon` (`weapon_id`),
  CONSTRAINT `fk_user_weapons_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_weapons_weapon`
    FOREIGN KEY (`weapon_id`) REFERENCES `weapons` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_user_weapons_level` CHECK (`level` >= 1),
  CONSTRAINT `ck_user_weapons_copies` CHECK (`copies` >= 1)
) ENGINE=InnoDB COMMENT='用户武器库存';

-- 每名用户固定四个出战槽位；同一把武器不能重复装备。
CREATE TABLE IF NOT EXISTS `user_loadout_slots` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `slot_no` TINYINT UNSIGNED NOT NULL COMMENT '1-4',
  `weapon_id` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`, `slot_no`),
  UNIQUE KEY `uk_user_loadout_weapon` (`user_id`, `weapon_id`),
  KEY `idx_user_loadout_weapon` (`weapon_id`),
  CONSTRAINT `fk_user_loadout_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_loadout_weapon`
    FOREIGN KEY (`weapon_id`) REFERENCES `weapons` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_user_loadout_slot` CHECK (`slot_no` BETWEEN 1 AND 4)
) ENGINE=InnoDB COMMENT='用户四槽出战编队';

-- 一次单抽或十连对应一个订单。client_request_id 用于接口幂等，避免重复扣款。
CREATE TABLE IF NOT EXISTS `gacha_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `client_request_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '客户端生成的 UUID',
  `pool_code` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `draw_count` TINYINT UNSIGNED NOT NULL,
  `cost_crystal` INT UNSIGNED NOT NULL,
  `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_gacha_orders_request` (`user_id`, `client_request_id`),
  KEY `idx_gacha_orders_user_time` (`user_id`, `created_at`),
  CONSTRAINT `fk_gacha_orders_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_gacha_orders_draw_count` CHECK (`draw_count` IN (1, 10))
) ENGINE=InnoDB COMMENT='抽卡订单';

-- 抽卡结果明细。rarity 保存抽取当时的稀有度快照，避免配置变更影响历史记录。
CREATE TABLE IF NOT EXISTS `gacha_results` (
  `order_id` BIGINT UNSIGNED NOT NULL,
  `result_no` TINYINT UNSIGNED NOT NULL,
  `weapon_id` BIGINT UNSIGNED NOT NULL,
  `rarity` ENUM('BASIC', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL,
  `is_new` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `copies` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`order_id`, `result_no`),
  KEY `idx_gacha_results_weapon` (`weapon_id`),
  CONSTRAINT `fk_gacha_results_order`
    FOREIGN KEY (`order_id`) REFERENCES `gacha_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gacha_results_weapon`
    FOREIGN KEY (`weapon_id`) REFERENCES `weapons` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_gacha_results_no` CHECK (`result_no` BETWEEN 1 AND 10),
  CONSTRAINT `ck_gacha_results_new` CHECK (`is_new` IN (0, 1)),
  CONSTRAINT `ck_gacha_results_copies` CHECK (`copies` >= 1)
) ENGINE=InnoDB COMMENT='抽卡结果明细';

-- 所有货币变动必须同时写流水。amount 为正表示获得，为负表示消耗。
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `currency` ENUM('CRYSTAL', 'GOLD') NOT NULL,
  `amount` BIGINT NOT NULL,
  `balance_after` BIGINT UNSIGNED NOT NULL,
  `biz_type` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'REGISTER、GACHA、REWARD 等',
  `biz_id` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '关联业务的幂等标识',
  `note` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wallet_transactions_biz` (`user_id`, `currency`, `biz_type`, `biz_id`),
  KEY `idx_wallet_transactions_user_time` (`user_id`, `created_at`),
  CONSTRAINT `fk_wallet_transactions_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_wallet_transactions_amount` CHECK (`amount` <> 0)
) ENGINE=InnoDB COMMENT='用户货币流水';

-- 可直接展示的局外累计数据；完成对局时由后端事务更新。
CREATE TABLE IF NOT EXISTS `user_progress` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `account_level` INT UNSIGNED NOT NULL DEFAULT 1,
  `account_exp` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `total_runs` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `total_kills` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `best_score` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `max_survival_seconds` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_progress_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_user_progress_level` CHECK (`account_level` >= 1)
) ENGINE=InnoDB COMMENT='用户局外成长汇总';

-- 每局战绩。排行榜可从这里计算并缓存到 Redis。
CREATE TABLE IF NOT EXISTS `game_runs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `client_run_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '客户端生成的 UUID',
  `status` ENUM('RUNNING', 'COMPLETED', 'ABANDONED', 'INVALID') NOT NULL DEFAULT 'RUNNING',
  `survival_seconds` INT UNSIGNED NOT NULL DEFAULT 0,
  `kills` INT UNSIGNED NOT NULL DEFAULT 0,
  `reached_level` INT UNSIGNED NOT NULL DEFAULT 1,
  `score` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `loadout_snapshot` JSON NOT NULL COMMENT '开局时四件武器 code 快照',
  `result_data` JSON NULL COMMENT '首领、升级选择等可选明细',
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ended_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_game_runs_request` (`user_id`, `client_run_id`),
  KEY `idx_game_runs_score` (`status`, `score` DESC, `ended_at`),
  KEY `idx_game_runs_user_time` (`user_id`, `started_at`),
  CONSTRAINT `fk_game_runs_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_game_runs_level` CHECK (`reached_level` >= 1),
  CONSTRAINT `ck_game_runs_time` CHECK (`ended_at` IS NULL OR `ended_at` >= `started_at`)
) ENGINE=InnoDB COMMENT='对局记录';

-- 与当前前端 menu-ui.js 对应的 8 把武器。
INSERT INTO `weapons`
  (`code`, `name`, `rarity`, `role_name`, `description`, `base_damage`, `attack_interval_ms`, `is_active`, `sort_order`, `metadata`)
VALUES
  ('pulse', '脉冲炮', 'BASIC', '主武器', '高频发射能量弹，自动锁定距离最近的目标。稳定、直接，适合任何构筑。', 10, 620, 1, 10, JSON_OBJECT('tone', 'cyan')),
  ('orbit', '轨道刃', 'RARE', '近身范围', '围绕玩家高速旋转，对接触的敌人造成连续切割与短距离击退。', 15, NULL, 1, 20, JSON_OBJECT('tone', 'violet')),
  ('chain', '链式闪电', 'RARE', '群体清场', '在多个邻近目标之间跳跃，敌群越密集，单次释放的收益越高。', 13, 2400, 1, 30, JSON_OBJECT('tone', 'blue')),
  ('nova', '震荡核心', 'EPIC', '范围爆发', '周期性释放大范围冲击波，击退包围玩家的敌群并创造移动空间。', 19, 5500, 1, 40, JSON_OBJECT('tone', 'gold')),
  ('drone', '哨戒无人机', 'RARE', '独立索敌', '自主选择远处目标并进行点射，帮助玩家清理漏网敌人。', 8, 800, 1, 50, JSON_OBJECT('tone', 'green')),
  ('frost', '零度射线', 'EPIC', '减速控制', '持续冻结前方敌群，降低其移动速度并叠加易伤。', 6, NULL, 1, 60, JSON_OBJECT('tone', 'ice')),
  ('void', '引力奇点', 'LEGENDARY', '聚怪爆发', '生成短暂奇点，将附近敌人吸入中心后引发一次坍缩爆炸。', 28, 8000, 1, 70, JSON_OBJECT('tone', 'red')),
  ('prism', '棱镜光矛', 'LEGENDARY', '直线贯穿', '蓄力后发射贯穿战场的高能光束，对同一直线上的所有敌人造成伤害。', 42, 3200, 1, 80, JSON_OBJECT('tone', 'rose'))
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `rarity` = VALUES(`rarity`),
  `role_name` = VALUES(`role_name`),
  `description` = VALUES(`description`),
  `base_damage` = VALUES(`base_damage`),
  `attack_interval_ms` = VALUES(`attack_interval_ms`),
  `is_active` = VALUES(`is_active`),
  `sort_order` = VALUES(`sort_order`),
  `metadata` = VALUES(`metadata`);

-- 注册成功后，后端应在同一个数据库事务中完成：
-- 1. 插入 users；
-- 2. 插入 user_wallets 和 user_progress；
-- 3. 将 pulse 以及计划赠送的初始武器插入 user_weapons；
-- 4. 将初始四槽编队插入 user_loadout_slots；
-- 5. 为初始晶核插入 wallet_transactions（biz_type=REGISTER）。
