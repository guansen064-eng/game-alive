# ALIVE // 生存协议——项目介绍

## 一、项目基本信息

| 项目项 | 内容 |
| --- | --- |
| 项目名称 | ALIVE // 生存协议 |
| 项目类型 | HTML5 Canvas 网页生存肉鸽游戏 |
| 项目性质 | 在校个人项目（第二个项目） |
| 开发方式 | 独立设计、开发与部署 |
| 运行平台 | PC 浏览器、手机浏览器 |
| 部署地址示例 | `http://203.0.113.10/alive/`（请替换为实际域名或服务器地址） |
| 系统架构 | 前后端分离、容器化部署 |

## 二、项目简介

ALIVE 是一款参考《吸血鬼幸存者》核心玩法开发的网页生存肉鸽游戏。玩家只需要控制角色移动，武器会自动索敌并攻击不断生成的敌人。玩家通过收集经验、升级并选择强化，逐步形成多武器组合，在持续增强的敌群、精英怪和首领压力下尽可能延长生存时间。

项目同时包含完整的账号与玩家数据服务。浏览器端负责游戏运行和交互，Java Spring Boot 后端负责注册、登录、会话及玩家数据接口，MySQL 保存用户和游戏永久数据，Redis 保存登录会话与限流状态。项目通过 Docker Compose 编排后端服务，并由 Nginx 提供静态文件和 API 反向代理。

## 三、项目目标

- 使用原生 Web 技术完成可直接在浏览器运行的游戏
- 同时适配 PC 键盘操作和移动端触控操作
- 将单机试玩扩展为带账号、数据持久化和跨设备同步的完整 Web 项目
- 实践 Spring Boot、MySQL、Redis、Docker Compose 和 Nginx 的组合应用
- 独立完成从需求设计、编码、测试到云服务器部署的完整流程

## 四、核心功能

### 4.1 游戏玩法

- 使用 `WASD` 或方向键移动角色，手机端使用虚拟摇杆
- 武器自动寻找目标并攻击，降低操作门槛
- 普通敌人、强化精英和定时首领战
- 经验掉落、等级成长和三选一强化
- 脉冲炮、轨道刃、链式闪电、范围冲击波等武器机制
- 多发、穿透、暴击、击退、护甲、拾取范围等成长方向
- 连杀计时、首领生命条、威胁等级和死亡结算
- PC 端支持按 `Esc` 直接退出当前局，按 `P` 暂停或继续
- 使用本地存储保存设备最佳成绩和音效偏好

### 4.2 用户系统

- 用户名和密码注册账号
- 登录、保持登录状态、获取当前用户和退出登录
- 使用 BCrypt 保存密码哈希，不保存明文密码
- 使用 HttpOnly Cookie 保存会话标识
- 使用 Redis 保存服务端会话并设置有效期
- 使用 Redis 对登录接口进行限流

### 4.3 玩家数据

- 保存玩家钱包和成长数据
- 保存玩家已拥有的武器及武器等级
- 支持四个武器槽位的出战编队
- 登录后从服务端加载武器库存和编队
- 修改编队后同步到 MySQL，实现跨设备保存
- 为抽卡订单、抽卡结果、资源流水和游戏战绩预留数据结构

### 4.4 菜单与界面

- 居中的初始游戏入口
- 独立登录与注册界面
- 武器图鉴、武器详情和四槽编队界面
- 补给抽取 UI
- 响应式 HUD、升级选择、暂停和结算界面

> 当前版本的补给抽取已完成界面和 MySQL 数据结构设计，完整抽卡后端接口与经济平衡仍属于后续迭代内容。

## 五、技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | HTML5、CSS3、原生 JavaScript |
| 游戏渲染 | HTML5 Canvas 2D、`requestAnimationFrame` |
| 浏览器能力 | Pointer Events、Web Audio API、localStorage |
| 后端 | Java 17、Spring Boot 3.4.5、Spring MVC |
| 数据访问 | Spring JDBC、JdbcTemplate、HikariCP、MySQL Connector/J |
| 数据库 | MySQL 8.0、InnoDB、utf8mb4 |
| 缓存与会话 | Redis 7、Spring Data Redis |
| 安全 | BCrypt、HttpOnly Cookie、登录限流、非 root 数据库账号 |
| 构建与测试 | Maven、JUnit 5、Mockito、Spring Boot Test |
| 容器化 | Docker、Docker Compose、Docker 多阶段构建 |
| Web 服务 | Nginx 静态资源托管、反向代理 |
| 部署环境 | Rocky Linux、腾讯云服务器 |

## 六、系统架构

```text
PC / 手机浏览器
        │
        │ HTTP
        ▼
      Nginx
        ├── /alive/      → HTML、CSS、JavaScript、Canvas 游戏
        └── /alive/api/  → Spring Boot REST API（127.0.0.1:3000）
                                  │
                     ┌────────────┴────────────┐
                     ▼                         ▼
                  MySQL 8                   Redis 7
              永久业务数据              会话与登录限流
```

前端与后端通过 RESTful API 和 JSON 交互。MySQL、Redis 和 Spring Boot API 位于 Docker Compose 创建的 `alive-net` 自定义网络中，通过服务名互相访问。API、MySQL 均只绑定宿主机回环地址，Redis 不映射宿主机端口。

## 七、后端设计

后端使用 Java 17 和 Spring Boot 3.4.5 开发，按认证、玩家数据、公共异常和系统健康检查划分模块。

已实现的主要接口：

```text
POST /api/auth/register     注册账号
POST /api/auth/login        登录账号
GET  /api/auth/me           获取当前登录用户
POST /api/auth/logout       退出登录
GET  /api/player/profile    获取玩家资料、武器和编队
PUT  /api/player/loadout    保存四槽武器编队
GET  /api/health            检查 MySQL 和 Redis 状态
```

主要实现特点：

- 使用 `JdbcTemplate` 显式编写 SQL，便于学习和掌握数据库交互过程
- 使用事务保证注册用户、创建钱包、初始化进度、发放初始武器和生成编队的一致性
- 使用 BCrypt 强度 12 对用户密码进行哈希
- 使用随机会话令牌配合 Redis 管理登录状态
- Cookie 设置为 HttpOnly，减少前端脚本读取会话令牌的风险
- 登录限流键由客户端 IP 与用户名组合生成
- 统一处理业务异常并返回结构化 JSON 错误
- 应用启动时拒绝使用 MySQL root 账号，强制使用独立应用账号 `alive_app`

## 八、MySQL 数据库设计

数据库名称为 `alive_game`，采用 MySQL 8.0、InnoDB 和 `utf8mb4` 字符集。

| 数据表 | 作用 |
| --- | --- |
| `users` | 用户账号、显示名称和密码哈希 |
| `user_wallets` | 玩家持有的货币和资源 |
| `weapons` | 武器基础配置和稀有度信息 |
| `user_weapons` | 玩家拥有的武器、等级和重复数量 |
| `user_loadout_slots` | 玩家四槽出战编队 |
| `gacha_orders` | 抽卡订单与幂等请求记录 |
| `gacha_results` | 单次抽卡获得的武器结果 |
| `wallet_transactions` | 玩家资源增减流水 |
| `user_progress` | 玩家等级、经验和累计进度 |
| `game_runs` | 每局游戏战绩和编队快照 |

数据库设计要点：

- 使用主键、唯一键和外键维护数据一致性
- 使用检查约束限制四槽编号、抽卡次数、武器等级等数据范围
- 使用唯一请求标识为抽卡和战绩提交预留幂等处理能力
- 使用 JSON 字段保存开局编队快照，避免历史战绩受到当前编队变化影响
- 使用钱包流水记录资源变化来源，为后续排错和经济系统扩展提供依据
- 应用通过 `alive_app` 账号访问 `alive_game`，不使用 root 账号

## 九、Redis 使用场景

- 保存登录会话，并根据“记住登录”设置不同有效期
- 对会话令牌做哈希后再作为 Redis Key，减少令牌直接暴露
- 对登录接口进行次数限制，降低暴力尝试风险
- 为后续排行榜缓存预留扩展空间

## 十、部署方案

项目使用 Docker Compose 管理三个服务：

```text
api      Spring Boot 后端
mysql    MySQL 8.0
redis    Redis 7
```

部署特点：

- 使用 `alive-net` 自定义 Docker 网络隔离项目服务
- 使用 Docker Volume 持久化 MySQL 和 Redis 数据
- 使用多阶段 Dockerfile 在构建阶段执行 Maven 打包，运行阶段只保留 JRE
- Maven 依赖通过腾讯云 Maven 镜像下载
- Nginx 对外只开放网站端口，API 通过 `/alive/api/` 反向代理
- MySQL 只监听服务器 `127.0.0.1:3306`，通过 Navicat SSH 隧道管理
- Redis 仅允许 Docker 内部服务访问
- 使用健康检查控制服务启动依赖，并设置容器自动重启策略

## 十一、测试情况

后端已编写并通过以下自动化测试：

- 登录限流逻辑测试
- Redis 会话创建及 Cookie 属性测试
- 玩家资料读取测试
- 四槽编队校验与保存测试

当前共执行 4 项测试，结果为 0 失败、0 错误。

## 十二、个人职责

- 分析并拆分游戏玩法、账号系统和玩家数据需求
- 设计 PC 与移动端响应式界面
- 实现 Canvas 游戏循环、角色移动、自动战斗、升级和首领逻辑
- 设计并实现登录、注册、武器库、编队和抽取界面
- 使用 Spring Boot 开发认证与玩家数据 REST API
- 设计 MySQL 表结构、外键、约束、索引和初始化数据
- 使用 Redis 实现服务端会话与登录限流
- 编写后端单元测试和服务健康检查
- 编写 Dockerfile、Docker Compose 和环境变量配置
- 在云服务器部署项目并配合 Nginx 完成静态资源与 API 路由

## 十三、项目亮点

1. **从单机游戏扩展为完整 Web 系统**：不仅实现浏览器游戏玩法，还加入账号、会话、数据库和跨设备数据同步。
2. **PC 与移动端统一适配**：键盘和触控输入统一转换为移动向量，界面根据屏幕尺寸自动调整。
3. **数据安全意识**：密码使用 BCrypt 哈希，后端拒绝 root 数据库账号，MySQL 不直接暴露公网端口。
4. **数据库结构具备扩展性**：除当前使用的用户、武器和编队数据外，还为抽卡、资源流水和战绩预留规范化结构。
5. **完整部署实践**：使用 Docker Compose、Nginx、MySQL、Redis 和 Spring Boot 完成云服务器部署。
6. **实现与规划边界清晰**：已完成核心玩法和基础数据闭环，抽卡后端和完整数值体系作为后续迭代方向。

## 十四、当前不足与后续计划

- 完成抽卡后端接口、概率配置、保底机制和资源扣除事务
- 将更多游戏战绩上传至后端并实现排行榜
- 使用对象池和空间索引优化大量敌人场景的性能
- 将武器、敌人和强化数值迁移为配置驱动
- 增加邮箱验证、找回密码和更完整的账号安全能力
- 启用 HTTPS，并在生产环境开启 Cookie Secure 属性
- 增加 API 集成测试和浏览器端自动化测试

## 十五、简历项目描述参考

> **ALIVE 网页生存肉鸽游戏｜个人项目**  
> 使用 HTML5 Canvas 和原生 JavaScript 开发同时适配 PC、移动端的生存肉鸽游戏，实现自动战斗、多武器强化、精英及首领战等玩法；使用 Java 17、Spring Boot、Spring JDBC 和 MySQL 8.0 构建账号与玩家数据服务，使用 Redis 管理登录会话与接口限流；通过 Docker Compose 编排 API、MySQL、Redis 服务，并使用 Nginx 完成静态资源部署和 REST API 反向代理。

## 十六、答辩介绍参考

> 这是我的第二个在校个人项目。我最初想完成一个可以直接在浏览器中游玩的生存肉鸽游戏，之后把它扩展成了前后端分离项目。前端使用原生 JavaScript 和 Canvas 实现游戏循环、自动战斗以及 PC 和手机适配；后端使用 Spring Boot 提供注册、登录、玩家资料和四槽编队接口；MySQL 保存用户、武器和成长数据，Redis 保存登录会话与限流状态。项目最终通过 Docker Compose 部署到云服务器，并由 Nginx 统一提供网页和 API 入口。这个项目让我完整实践了从功能设计、数据库建模、后端开发到服务器部署的整个流程。
