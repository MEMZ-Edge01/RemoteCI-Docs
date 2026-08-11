---
title: 项目架构
icon: diagram-project
order: 1
---

# 项目架构

RemoteCI 采用一个主项目仓库和一个独立文档仓库。

## 运行组件

~~~text
ClassIsland 插件 ── 局域网 WebSocket ── Wear OS
       │                                  │
       └──────── 云端 WebSocket ──────────┘
                         │
                 RemoteCI 服务端
             账号 / 权限 / 状态 / 课表
~~~

| 目录 | 技术 | 职责 |
| --- | --- | --- |
| <code>plugin</code> | .NET、ClassIsland Plugin SDK | 收集课表状态、提供局域网连接、执行远程命令 |
| <code>server</code> | ASP.NET Core、SQLite、WebSocket | 身份认证、权限检查、状态保存和消息中转 |
| <code>wearos</code> | Kotlin、Compose for Wear OS | 展示课程、课表和操作界面 |
| <code>shared</code> | C# 模型库 | 插件与服务端共享协议和数据模型 |

## 数据流

1. 插件从 ClassIsland 收集状态和七日课表。
2. 插件将数据推送给局域网手表和云端服务端。
3. 服务端保存最近状态，并转发给已认证的手表。
4. 手表提交操作时，服务端先检查账号权限，再把命令转发给插件。
5. 插件执行后返回结果，服务端再把结果传回手表。

## 身份与权限

服务端使用 SQLite 持久化用户、密码哈希、设备会话、插件凭据和一次性配对码。访问令牌是短期令牌，设备会话用于续期；插件使用一次性配对码建立长期凭据。

## 开发状态

当前源码正在从早期共享配对码协议迁移到账号、权限和设备会话协议。开发或发布前必须以同一提交同时验证插件、服务端和 Wear OS 客户端，不能只验证单个项目能够编译。

