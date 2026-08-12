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

服务端、插件和手表使用三种不同的升级方式：

- 服务端：管理员登录 WebUI 后，在“个人账号 → 系统更新”点击“检查更新”，从 GitHub 最新 release 下载当前平台包并就地覆盖，随后服务端进程自动退出。Docker 的 <code>restart: unless-stopped</code> 会以新文件重新启动容器，启动时自动执行数据库迁移。注意：直接以 <code>dotnet</code> 在 Windows 上运行服务端时，运行中的程序集会被锁定，自动更新可能失败，建议使用 Docker。
- 插件：不做内置更新界面，由 ClassIsland 插件市场统一管理；每个 release 都附带 CIPX 与 checksums，指向 release 地址即可自动拉取新版本。
- 手表：在“设置 → 更新”检查 GitHub 最新 release，下载 APK 并通过系统安装器覆盖安装；要求发布包与当前安装包签名一致。

升级前应先备份数据库卷，且尽量让三端保持同一版本，避免协议版本不一致。

手动升级服务端时：

~~~powershell
docker compose stop remoteci
# 先备份 remoteci-data 卷，再构建或拉取新镜像。
docker compose up -d
docker compose logs --tail 200 remoteci
~~~

## 安全清单

- 公网入口仅开放 443，并启用有效 HTTPS 证书。
- 8080 只绑定到回环地址或受信任的容器网络。
- 初始密码至少 8 位，实际部署建议使用随机长密码。
- 不在 Compose 文件、截图或问题反馈中公开密码、令牌和配对码。
- 普通用户按最小权限分配，设备丢失后立即撤销会话。
- “主界面与电源控制”（SystemControl）单独保护主界面显隐与电源操作，不要与发送通知权限混用。
- 定期备份并实际演练恢复。
- 定期更新服务端镜像、插件和手表应用。
