# Mission: Alive 项目部署与数据库连接

## Why
为了独立部署 Alive 网页游戏，并能从 Windows 安全连接服务器中的 MySQL，完成开发和数据检查。

## Success looks like
- 能从 Windows 建立到服务器 MySQL 的 SSH 隧道
- 能使用数据库客户端通过隧道登录 `alive_game`
- 更换云服务器时只需替换连接地址，不暴露数据库公网端口

## Constraints
- 当前重点是能实际操作，术语解释保持入门级
- 项目使用 Windows 开发机、Rocky Linux 服务器和 Docker Compose

## Out of scope
- SSH 密钥体系和企业级堡垒机
- 复杂网络与数据库安全运维
