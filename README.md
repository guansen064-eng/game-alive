# ALIVE // 生存协议

一款同时适配 PC 与移动端的 HTML5 Canvas 生存肉鸽游戏。玩家只控制移动，武器自动寻找目标；通过局内三选一强化构筑多武器组合，在持续增长的敌群压力下尽可能生存。

项目采用前后端分离架构：浏览器端负责游戏与界面，Java Spring Boot API 负责账号和玩家数据，MySQL 8 保存永久数据，Redis 保存登录会话与限流状态。

## 在线部署

网页静态文件仍由 Nginx 提供：

```text
index.html
style.css
gacha.css
audio.js
gacha-ui.js
menu-ui.js
auth-ui.js
balance.js
weapons.js
director.js
upgrade-system.js
game.js
```

数据库功能通过 Docker Compose 启动。复制环境配置并修改全部密码：

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

Compose 会启动 `api`、`mysql`、`redis` 三个服务，并创建自定义网络 `alive-net`。API 只绑定服务器本机 `127.0.0.1:3000`；请在你自己的 Nginx 配置中将 `/alive/api/` 转换并反向代理到后端的 `/api/`。Redis 不开放宿主端口。

MySQL 默认映射到服务器 `127.0.0.1:3306`。从 Windows 管理数据库时，先建立 SSH 隧道：

```bash
ssh -L 3307:127.0.0.1:3306 服务器用户名@服务器地址
```

随后在 Navicat、DataGrip 或 MySQL Workbench 中连接 `127.0.0.1:3307`，账号使用 `.env` 中的 `MYSQL_USER`，不要使用 root。如果确实需要公网直连，可把 `MYSQL_BIND_ADDRESS` 改为 `0.0.0.0`，但必须在云服务器安全组和防火墙中仅放行你的固定 IP。

MySQL 容器会自动创建 `.env` 中指定的 `MYSQL_USER`（默认 `alive_app`）并授予 `alive_game` 数据库权限。Spring Boot 后端只使用该账号，并会拒绝使用 root 启动。首次创建 MySQL 数据卷时会自动执行 `sql/alive_game_schema.sql`。

学习或本地检查 Spring Boot 后端时，可以执行：

```bash
cd backend
mvn test
mvn package
```

生成的可执行文件是 `backend/target/alive-game-api.jar`。正常容器部署不需要手动上传 JAR，Docker 多阶段构建会自动完成 Maven 打包。

直接双击 `index.html` 仍能以游客模式试玩，但真实登录和数据同步必须通过配置好 `/api/` 代理的服务器地址访问。

## 操作方式

- PC：`WASD` 或方向键移动，`P` 暂停，`Esc` 放弃本局，数字键 `1`–`3` 选择强化
- 手机和平板：使用左下角虚拟摇杆移动，点击强化选项
- 战斗：所有武器自动瞄准和释放
- 背景音乐：主菜单可调整并记住音乐音量，0% 仅保留音效；战斗右上角 ♪ 同时控制音乐和音效。
- 「深空脉冲」为原创 Web Audio 合成循环配乐，100 BPM 小调氛围铺底与电子节拍；Boss 战增加节奏层，升级选择时减弱为氛围层。开始游戏后播放，暂停、后台、结算和返回菜单时停止，新一局重新开始。

## 核心玩法

- 自动索敌脉冲炮，支持多发、穿透、暴击和击退
- 四槽编队会真实决定局内初始武器，支持脉冲炮、轨道刃、链式闪电、震荡核心和哨戒无人机
- 五把武器均可升至 5 级，并通过对应辅助强化进化为终极形态
- 追猎体、疾行体、重装体、强化精英和定时首领战
- 经验掉落、升级三选一和 15 种强化方向
- 升级选项具有单轮防重复规则，前八级每轮至少提供两项输出向强化
- 连杀计时、最高连杀与首领生命条
- 连续击杀积累超载充能，启动后获得增伤、加速和武器冷却增益
- 配置化的经验、敌潮和首领曲线，前期升级速度与基础输出经过自动化平衡测试
- 五阶段、五次特殊敌潮事件与十分钟最终 Boss 构成完整单局流程
- 本地最佳纪录与死亡结算
- 初始菜单、武器图鉴、四槽出战编队和补给抽取 UI
- 单抽 / 十连开箱动画：机械补给箱落地、蓄能开盖、稀有度光柱与奖励展台。可勾选记住“跳过开箱动画”，播放中点击跳过或按 Esc 直接查看同一组结果；再次按 Esc 返回。系统减少动态效果设置下自动跳过。
- 抽取仍为免费演示：从现有八把武器中等概率选择（可重复），不会扣除晶核、发放库存或累计保底。
- MySQL 账号注册、登录和玩家数据持久化
- Redis 登录会话与登录接口限流
- 武器库存与四槽编队跨设备同步
- 基于 Web Audio API 实时生成的游戏音效，无外部音频资源

## 技术实现

- 使用 Canvas 2D API 构建游戏渲染循环、摄像机和粒子效果
- 使用 `requestAnimationFrame` 与时间增量保证不同刷新率下移动速度一致
- 键盘输入与 Pointer Events 虚拟摇杆统一为二维移动向量
- 使用设备像素比适配高分屏，并限制最大渲染倍率控制开销
- 使用数组倒序更新管理敌人、弹丸、经验和粒子生命周期
- 使用 `localStorage` 保存设备本地最佳成绩与音效偏好
- 使用 Web Audio API 合成射击、暴击、受伤、升级和首领音效
- 使用 Java 17、Spring Boot 和 Spring JDBC 提供账号及玩家数据 API
- 使用 HttpOnly Cookie 与 Redis 保存服务端会话
- 使用 Docker Compose 管理 API、MySQL 和 Redis

## 项目结构

```text
alive/
├─ index.html          # 页面结构、HUD 与游戏弹窗
├─ style.css           # 响应式界面、PC/移动端布局
├─ balance.js          # 经验、敌人、首领与初始属性平衡参数
├─ weapons.js          # 四槽编队、武器等级和进化配方
├─ director.js         # 十分钟阶段、特殊敌潮与最终 Boss 时间线
├─ upgrade-system.js   # 升级抽取、防连续重复与前期输出保底规则
├─ game.js             # 游戏循环、实体、武器与碰撞逻辑
├─ audio.js            # 独立的浏览器音效模块
├─ gacha-ui.js         # 补给开箱动画、跳过与演示结果状态管理
├─ gacha.css           # 机械补给箱、稀有度光柱和响应式奖励展台
├─ menu-ui.js          # 武器库、编队与补给抽取界面逻辑
├─ auth-ui.js          # 真实 API 注册、登录与会话界面逻辑
├─ backend/            # Spring Boot Maven 工程与 Dockerfile
├─ sql/                # MySQL 8 建表及武器初始数据
├─ docker-compose.yml  # API、MySQL、Redis 和 alive-net
├─ .env.example        # 部署环境变量示例
├─ tests/              # Node.js 玩法回归测试
├─ project.godot       # 保留的 Godot 4 原型
└─ scripts/            # Godot 版脚本
```

## 项目经历描述参考

> 独立开发跨平台 HTML5 Canvas 生存肉鸽游戏，完成响应式 HUD、键盘/触控输入、自动战斗、多武器升级和首领战；采用 Java Spring Boot、MySQL、Redis 构建账号与玩家数据服务，通过 HttpOnly Cookie 管理会话，并使用 Docker Compose 与自定义网络完成容器化部署。

## 后续计划

开箱界面可通过 `node tests/gacha.browser.cjs` 运行本机 Edge/Chrome 浏览器回归；可传入截图输出目录，或用 `ALIVE_BROWSER` 指定浏览器路径。覆盖完整播放、单抽 / 十连、跳过不重抽、关闭清理、键盘操作、减少动态效果与手机端滚动。该检查只使用本机演示页面，无需启动数据库。

- 使用对象池降低高频实体创建带来的垃圾回收压力
- 使用空间哈希减少大量敌人场景中的碰撞检测次数
- 扩展更多敌人行为和随机事件变体
- 增加更多地图机制、Boss 招式和局外成长内容
- 增加性能面板、自动化测试与 PWA 离线支持

## 登录与数据安全

密码由后端使用 bcrypt 哈希后保存，浏览器和数据库都不保存明文密码。会话令牌保存在 HttpOnly Cookie 中，对应会话数据位于 Redis。正式启用 HTTPS 后，将 `.env` 中的 `COOKIE_SECURE` 改为 `true`。当前版本尚未实现找回密码和邮箱验证。

## Godot 原型

仓库仍保留早期 Godot 4 原型。安装 Godot 4.3 或更高版本后导入 `project.godot` 即可运行。
