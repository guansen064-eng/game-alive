-- 修复首次初始化时因连接字符集错误而产生的中文乱码。
-- 仅覆盖数据库/表字符集、元数据注释和 weapons 初始化配置，不删除业务数据。

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER DATABASE `alive_game`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `alive_game`;

ALTER TABLE `users`
  COMMENT = '用户账号',
  MODIFY COLUMN `username` VARCHAR(20) NOT NULL COMMENT '登录账号，后端统一转为小写',
  MODIFY COLUMN `display_name` VARCHAR(32) NOT NULL COMMENT '游戏内显示名称',
  MODIFY COLUMN `status` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '0=禁用，1=正常';

ALTER TABLE `user_wallets`
  COMMENT = '用户货币余额',
  MODIFY COLUMN `crystal` BIGINT UNSIGNED NOT NULL DEFAULT 1280 COMMENT '能量晶核',
  MODIFY COLUMN `gold` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '金币';

ALTER TABLE `weapons`
  COMMENT = '武器配置',
  MODIFY COLUMN `code` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '前后端共用的稳定标识',
  MODIFY COLUMN `attack_interval_ms` INT UNSIGNED NULL COMMENT '持续型武器可为 NULL',
  MODIFY COLUMN `metadata` JSON NULL COMMENT '表现层扩展字段，例如颜色 tone';

ALTER TABLE `user_weapons`
  COMMENT = '用户武器库存';

ALTER TABLE `user_loadout_slots`
  COMMENT = '用户四槽出战编队',
  MODIFY COLUMN `slot_no` TINYINT UNSIGNED NOT NULL COMMENT '1-4';

ALTER TABLE `gacha_orders`
  COMMENT = '抽卡订单',
  MODIFY COLUMN `client_request_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '客户端生成的 UUID';

ALTER TABLE `gacha_results`
  COMMENT = '抽卡结果明细';

ALTER TABLE `wallet_transactions`
  COMMENT = '用户货币流水',
  MODIFY COLUMN `biz_type` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'REGISTER、GACHA、REWARD 等',
  MODIFY COLUMN `biz_id` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '关联业务的幂等标识';

ALTER TABLE `user_progress`
  COMMENT = '用户局外成长汇总';

ALTER TABLE `game_runs`
  COMMENT = '对局记录',
  MODIFY COLUMN `client_run_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '客户端生成的 UUID',
  MODIFY COLUMN `loadout_snapshot` JSON NOT NULL COMMENT '开局时四件武器 code 快照',
  MODIFY COLUMN `result_data` JSON NULL COMMENT '首领、升级选择等可选明细';

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

SELECT `TABLE_NAME`, `TABLE_COMMENT`
FROM `information_schema`.`TABLES`
WHERE `TABLE_SCHEMA` = 'alive_game'
ORDER BY `TABLE_NAME`;

SELECT `code`, `name`, `role_name`
FROM `weapons`
ORDER BY `sort_order`;
