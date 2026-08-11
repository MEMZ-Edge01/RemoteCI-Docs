---
title: Docker 部署
icon: server
order: 1
---

# Docker 部署

Docker 是当前最直接的部署方式。RemoteCI 服务端使用 ASP.NET Core 10 和 SQLite，数据库默认保存在容器内的 <code>/app/data/remoteci.db</code>。

::: warning 验证边界
本文配置依据当前 Dockerfile 和服务端源码整理，文档站构建已经通过，但未在 RemoteCI 目录内构建镜像或启动服务。当前客户端协议也仍有不一致，详见[开发状态](../guide/status.md)。
:::

## 前置条件

- 已安装 Docker Engine 24 或更新版本。
- 已获取 RemoteCI 源码。
- TCP 8080 未被其他程序占用。
- 公网部署时，已准备域名、HTTPS 证书和反向代理。

## 构建镜像

Dockerfile 会同时复制 <code>shared</code> 和 <code>server</code>，因此必须在 RemoteCI 仓库根目录执行构建：

~~~powershell
docker build --file server/RemoteCI.Server/Dockerfile --tag remoteci-server:local .
~~~

## 使用 Compose 启动

在服务器上创建单独的部署目录，并保存以下 <code>compose.yml</code>：

~~~yaml
services:
  remoteci:
    image: remoteci-server:local
    container_name: remoteci
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      - REMOTECI_ADMIN_PASSWORD
      - REMOTECI_PLUGIN_PAIR_CODE
      - Server__BootstrapAdminUsername=admin
      - Server__DatabasePath=data/remoteci.db
    volumes:
      - ./data:/app/data
~~~

再创建不提交到 Git 的 <code>.env</code>：

~~~dotenv
REMOTECI_ADMIN_PASSWORD=请替换为至少8位的强密码
REMOTECI_PLUGIN_PAIR_CODE=请替换为一次性随机配对码
~~~

启动并查看日志：

~~~powershell
docker compose up -d
docker compose logs -f remoteci
~~~

::: warning 不要省略数据卷
没有 <code>./data:/app/data</code> 时，删除容器会同时丢失账号、设备会话和配对信息。
:::

## 验证服务

~~~powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
~~~

正常响应应包含 <code>status</code> 和协议版本。随后打开服务端页面，使用管理员账号登录并立即修改初始密码。

## 配置 HTTPS

公网环境不要直接暴露 8080 端口。推荐让 Caddy 或 Nginx 终止 TLS，再转发 HTTP 和 WebSocket。

最小 Caddyfile：

~~~text
remoteci.example.com {
    reverse_proxy 127.0.0.1:8080
}
~~~

Caddy 会自动转发 WebSocket 握手。请把 <code>remoteci.example.com</code> 替换为真实域名，并确认代理发送 <code>X-Forwarded-Proto</code>。

::: danger 公网必须使用 HTTPS
HTTP 和 WS 不能保护登录密码、访问令牌与课表内容。不要通过端口映射把 8080 直接开放到公网。
:::

## 连接插件和手表

- 插件的云端服务地址填写 <code>https://remoteci.example.com</code>。
- 手表的云端服务地址填写同一个地址。
- 不要手写 <code>/api</code> 或 <code>/ws</code> 路径，客户端会自动拼接。
