---
title: 项目架构
icon: diagram-project
order: 1
---

# 项目架构

RemoteCI 采用一个主项目仓库和一个独立文档仓库。当前三端按协议 v2 对齐，版本为 v0.2。

## 运行组件

~~~text
ClassIsland 插件 ── 局域网 WebSocket（HMAC 挑战认证）── Wear OS
       │                                        │
       └──────────── 云端 WebSocket ────────────┘
                             │
                     RemoteCI 服务端
               账号 / 权限 / 状态 / 课表 / 命令中转
~~~

| 目录 | 技术 | 职责 |
| --- | --- | --- |
| <code>plugin</code> | .NET 8、ClassIsland Plugin SDK | 收集课表状态、提供局域网服务、执行远程命令、注册扩展、旁路观察通知 |
| <code>server</code> | ASP.NET Core 10、SQLite、WebSocket | 身份认证、权限检查、状态保存、消息中转与自动更新 |
| <code>wearos</code> | Kotlin、Compose for Wear OS（minSdk 30） | 展示课程、课表、通知与操作界面 |
| <code>shared</code> | C# 模型库 | 插件与服务端共享协议 v2 和数据模型 |

## 数据流

1. 插件从 ClassIsland 收集状态与七日课表，状态按秒推送，课表独立低频同步。
2. 插件把数据推送给局域网手表和云端服务端；服务端保存最近状态并转发给已认证手表。插件每次云端连接还会上报本机候选 IP、局域网端口与服务状态，服务端缓存并同步给手表用于自动直连。
3. 手表提交命令时，服务端先检查账号权限，再把命令转发给在线插件。
4. 插件执行后返回真实回执（成功、失败码、新修订号），服务端再把结果传回发起方，等待上限 15 秒。
5. 插件旁路观察 ClassIsland 统一通知入口，把自动化“显示提醒”和第三方插件通知转换为事件广播；其他插件注册的扩展功能清单通过 <code>extensions_sync</code> 同步给手表。
6. 首次登录可用 UDP <code>48765</code> 扫描插件；选中后通过未登录的 <code>/bootstrap</code> WebSocket 仅读取云服务器地址。密码仍通过云端 HTTPS 登录，设备会话同步给插件后再进行局域网 HMAC 认证。

## 协议 v2 消息

所有 WebSocket 信封都带 <code>protocolVersion: 2</code>、<code>type</code>、<code>messageId</code> 与可选 <code>replyToMessageId</code>。主要类型：

| 类型 | 方向 | 用途 |
| --- | --- | --- |
| <code>auth_challenge</code> / <code>auth_proof</code> | 插件 ↔ 手表 | 局域网一次性 HMAC 挑战认证 |
| <code>account_sync</code> | 服务端 → 插件 | 账号、权限、设备验证器与服务端版本镜像 |
| <code>state_push</code> | 插件 → 服务端/手表 | 高频当前课程状态 |
| <code>schedule_sync</code> | 插件 → 服务端/手表 | 未来七日课表 |
| <code>schedule_pull</code> | 服务端/手表 → 插件 | 请求插件立即重新生成并推送七日课表；不携带参数 |
| <code>extensions_sync</code> | 插件 → 服务端/手表 | 扩展功能清单 |
| <code>event_notify</code> | 插件 → 服务端/手表 | 上课、课间、放学、课表变更、自定义、自动化与插件通知事件 |
| <code>plugin_network_info</code> | 插件 → 服务端 → 手表 | 可用局域网 IP、监听端口与局域网服务状态；服务端缓存最近一次结果 |
| <code>connection_bootstrap</code> | 插件 → 手表 | 用户选中局域网插件后提供电脑名称与云服务器地址；不携带认证数据 |
| <code>command</code> / <code>command_result</code> | 手表/服务端 → 插件 | 换课、通知、清除提醒、主界面、电源、音量与扩展命令 |

命令编号：1 换课、2 发送通知、3 清除提醒、4 主界面显隐、5 电源、6 音量、7 运行扩展。事件编号：1 上课、2 课间、3 放学、4 课表变更、5 自定义、6 自动化通知、7 第三方插件通知。

插件完成云端认证后，服务端立即发送一次 <code>schedule_pull</code>，以消除“插件启动时已生成课表、但 WebSocket 尚未连上”的竞态。已认证手表也可发出同一只读消息：云端由服务端转发，局域网由插件直接处理；该消息与换课命令分离，不需要也不会授予管理课表权限。

## 身份与权限

服务端使用 SQLite 持久化用户、PBKDF2 密码哈希、设备会话、插件凭据和一次性配对码。有效权限是位掩码：

| 值 | 权限 |
| --- | --- |
| 1 | 查看当前课程 |
| 2 | WebUI 访问 |
| 4 | 人员管理 |
| 8 | 发送与清除通知 |
| 16 | 换课 |
| 32 | 主界面与电源控制 |

管理员有效权限固定为 63；普通用户固定含值 1。访问令牌默认 1 小时，设备会话默认 30 天可续期；插件用一次性配对码换取长期凭据。授权镜像超过 24 小时未更新时，局域网直连只允许查看课程。

云端与局域网认证成功时，<code>auth_state.serverVersion</code> 都会携带当前 WebUI 版本；局域网值来自 <code>account_sync.serverVersion</code>。手表在本机持久化正式版/Beta 渠道与同版本强制覆盖选项，更新选择器仍以该服务端版本作为不可绕过的 SemVer 上限。

## 版本与构建

- 插件 0.3.1.0：net8.0，兼容 ClassIsland 2.x 宿主；CIPX 由 <code>CreateCipx=true</code> 生成。
- 服务端 0.3.1：net10.0，发布 linux-x64 / win-x64 平台包。
- 手表 0.3.1：minSdk 30 / targetSdk 37，Release APK 使用签名密钥构建。

## 开发状态

v0.3.1 已完成三端协议对齐、跨平台更新修复与 CI 配置。发布前仍应以同一版本在真机完成端到端验收，见[开发状态](../guide/status.md)。
