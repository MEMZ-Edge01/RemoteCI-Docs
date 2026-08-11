---
title: 运维与安全
icon: shield-halved
order: 3
---

# 运维与安全

## 日常检查

~~~powershell
docker compose ps
docker compose logs --tail 200 remoteci
Invoke-RestMethod https://remoteci.example.com/api/health
~~~

同时在管理页面确认插件在线、手表连接数和最近一次课表同步时间。

## 备份

SQLite 数据库包含账号、权限、会话和插件凭据。为避免复制到一半的数据库，建议短暂停止容器后备份整个数据目录：

~~~powershell
docker compose stop remoteci
Copy-Item -Recurse .\data ".\backup\data-$(Get-Date -Format yyyyMMdd-HHmmss)"
docker compose start remoteci
~~~

备份文件与生产数据库具有同等敏感性，应加密保存并限制访问。

## 恢复

1. 停止容器。
2. 备份当前数据目录。
3. 用同一版本或兼容版本的备份替换数据目录。
4. 启动容器并检查迁移日志和健康检查。
5. 验证管理员登录、插件连接和手表登录。

不要在容器运行时直接覆盖 SQLite 文件。

## 升级

~~~powershell
docker compose stop remoteci
# 先备份 data 目录，再构建或拉取新镜像。
docker compose up -d
docker compose logs --tail 200 remoteci
~~~

服务端启动时会自动执行数据库迁移。升级后应同时更新插件和手表端，避免协议版本不一致。

## 安全清单

- 公网入口仅开放 443，并启用有效 HTTPS 证书。
- 8080 只绑定到回环地址或受信任的容器网络。
- 初始密码至少 8 位，实际部署建议使用随机长密码。
- 不在 Compose 文件、截图或问题反馈中公开密码、令牌和配对码。
- 普通用户按最小权限分配，设备丢失后立即撤销会话。
- 定期备份并实际演练恢复。
- 定期更新服务端镜像、插件和手表应用。

