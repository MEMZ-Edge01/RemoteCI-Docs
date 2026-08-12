# RemoteCI 当前源码与文档站调研审计（v0.2）

> 审计日期：2026-08-12 喵～
>
> 审计边界：本报告只读核对 `D:\Files\Codes\Projects\RemoteCI` 当前 HEAD（e159614）源码，并对照 RemoteCI-Docs 文档站内容喵～
>
> 重要说明：按照“不要动 RemoteCI”的要求，本次未运行构建、测试或服务，因为构建会写入 `bin`、`obj` 等目录喵～ 测试数量与功能事实均来自源码静态核对喵～

## 1. 项目定位与版本

- RemoteCI 是面向 ClassIsland 2.x 的课表手表联动系统，由 ClassIsland 插件、ASP.NET Core 服务端、Wear OS 应用与共享协议组成喵～
- 插件版本 0.2.0.0、手表版本 0.2.0（versionCode 2）、服务端版本 0.2.0，分别见 `manifest.yml`、`wearos/app/build.gradle.kts` 与 Release 产物喵～
- 三端已按协议 v2 对齐，上一轮审计记录的配对端点、登录字段、命令编号与课表模型不一致均已修复喵～

## 2. 当前源码体现的核心功能

### 2.1 服务端

- ASP.NET Core 10 + Identity + SQLite，PBKDF2 密码哈希，密码 8-128 位，连续失败 8 次锁定 10 分钟，见 `server/RemoteCI.Server/Program.cs` 喵～
- 访问令牌默认 1 小时，设备会话默认 30 天，见 `server/RemoteCI.Server/Services/ServerOptions.cs` 喵～
- Razor WebUI 提供概览、人员权限、七日课表、发送通知、个人账号与系统更新页面，见 `server/RemoteCI.Server/Pages/` 喵～
- REST 端点包括 `/api/plugin/pair`、`/api/auth/login|refresh|logout`、`/api/me*`、`/api/state`、`/api/schedule`、`/api/commands`、`/api/users*`、`/api/plugin/pairing-code`、`/api/admin/status`、`/api/health` 喵～

### 2.2 权限

- 有效权限位掩码：1 查看当前课程、2 WebUI、4 人员管理、8 发送与清除通知、16 换课、32 主界面与电源控制，见 `shared/RemoteCI.Shared/Protocol.cs` 喵～
- 管理员有效权限固定 63；普通用户固定含 1，其余由管理员分配，见 `IdentityCoordinator.cs` 喵～
- 服务端是账号与权限唯一真源，插件通过 `account_sync` 接收不含密码的镜像；镜像超过 24 小时未更新时只允许查看课程喵～

### 2.3 插件

- 每秒推送状态、独立同步未来七日课表；支持交换与替换课程并用修订号防并发，见 `StateCollector.cs`、`ScheduleMutation.cs` 喵～
- 局域网使用设备会话派生验证器的一次性 HMAC 挑战认证，见 `LanServer.cs` 喵～
- 自定义通知由 ClassIsland 正式通知提供方显示并强制添加“由用户名发送：”前缀，支持强调特效、音效与语音三开关，见 `CommandHandler.cs` 喵～
- 通过 Harmony 旁路观察统一通知入口，把自动化“显示提醒”（事件 6）与第三方插件通知（事件 7）广播给手表，见 `ClassIslandNotificationBridge.cs` 喵～
- 控制命令：1 换课、2 发送通知、3 清除提醒、4 主界面显隐、5 电源、6 音量、7 运行扩展，见 `Command.cs` 与 `Protocol.cs` 喵～
- 扩展注册表 `IRemoteCiExtensionRegistry` 允许其他插件注册远程功能，参数类型 Text/Number/Switch/Select，见 `plugin/RemoteCI.Plugin/Extensions/` 喵～

### 2.4 手表端

- Wear OS 3+（minSdk 30），页面包括登录、主页、课表、换课、控制、通知、音量、电源、扩展表单、设置、连接、更新等，见 `RemoteCiApp.kt` 与 `WatchScreens.kt` 喵～
- 连接先局域网后云端，30 天设备会话由 Android Keystore AES-GCM 加密保存，见 `ConnectionManager.kt` 与 `SecureSessionStore.kt` 喵～
- 七类通知事件可逐类开关，见 `SettingsStore.kt` 喵～
- “老师来了”快捷提醒：标题“老师来了”、仅强调特效、1 秒后自动清除，见 `RemoteCiApp.kt` 喵～

### 2.5 更新与发布

- WebUI 管理员在个人账号页从 GitHub release 检查并下载当前平台包，就地覆盖后自动退出，依赖 Docker `restart: unless-stopped` 重启，见 `UpdateService.cs` 喵～
- 手表端在设置页下载 APK 覆盖安装，要求签名一致，见 `UpdateManager.kt` 喵～
- 插件更新由 ClassIsland 插件市场管理，release 附带 CIPX 与 checksums.md 喵～
- Release 工作流在 `v*` 标签时产出服务端 linux-x64/win-x64 压缩包、插件 CIPX、签名或未签名 APK，见 `.github/workflows/release.yml` 喵～

## 3. 协议 v2 要点

- 所有信封带 `protocolVersion: 2`、`type`、`messageId`、可选 `replyToMessageId`，见 `Envelope.cs` 喵～
- 消息类型：auth_challenge/auth_proof、account_sync、state_push、schedule_sync、extensions_sync、event_notify、command/command_result 喵～
- 局域网认证：`verifier = SHA256(UTF8(deviceSecret))`，HMAC-SHA256 证明，挑战 30 秒过期且先消费后校验喵～
- 换课请求携带 expectedRevision，修订号变化时返回 `SCHEDULE_STALE` 喵～

## 4. 配置项

- 服务端：`Server:DatabasePath`、`Server:BootstrapAdminUsername`、`Server:BootstrapAdminPassword`、`Server:BootstrapPluginPairCode`、`Server:AccessTokenTtl`、`Server:DeviceSessionTtl`，以及 `REMOTECI_ADMIN_PASSWORD`、`REMOTECI_PLUGIN_PAIR_CODE` 两个环境变量喵～
- 配对码在使用前持续有效、成功配对后立即作废，生命周期只由 UsedAt 控制，`PluginPairingCodeTtl` 已不存在，见 `IdentityCoordinator.cs` 喵～
- 插件：启用局域网（8765）、启用云端、云端地址（默认 localhost:8080）、一次性配对码喵～
- 手表：ID、云端开关与地址（默认 10.0.2.2:8080）、局域网开关与主机端口、七个通知开关喵～

## 5. 测试与 CI

- C# 端测试 12 个文件约 48 个用例：服务端 24（ApiTests 13、WebSocketRelayTests 7、UpdateServiceTests 4）、插件 24（扩展路由 7、扩展注册表 3、通知标题 3、换课 3、账号镜像 2、通知桥接 2、命令权限 2、兼容 1、通知提供方 1）喵～
- 手表端 3 个文件 15 个用例：WatchScreensTest 8、UpdateManagerTest 4、AuthorizationAndNotificationTest 3 喵～
- CI 工作流：dotnet build + dotnet test（Release）、gradle assembleDebug + testDebugUnitTest，见 `.github/workflows/ci.yml` 喵～
- 未在本地重新运行测试，测试数量为源码静态统计，不宣称“当前全部通过”喵～

## 6. 验证边界与未确认事项

- 未在 RemoteCI 目录内构建、测试或运行服务，因此本报告不能替代 GitHub Actions 与真机验收喵～
- 待真机验收：局域网挑战认证与云端回退、通知与振动、音量与电源实际控制、扩展执行、自动更新安装、Docker/HTTPS/备份恢复演练喵～
- 服务端状态与七日课表保存在内存，服务重启后丢失，SQLite 只承载身份、会话与插件凭据喵～

## 7. 与上一轮审计（2026-08-11）的差异

- 已修复：插件配对端点统一到 `/api/plugin/pair`、手表登录字段统一为 accessToken 系列、命令编号与载荷统一、课表模型统一为 ScheduleBundle、连接调用统一传密码、管理页面替换为 Razor WebUI 喵～
- 新增功能：音量、电源、主界面控制、通知三开关、“老师来了”、扩展注册表与 RunExtension、WebUI 与手表自动更新、仓库自带 compose.yaml 与 GitHub Actions 喵～
- 文档站对应更新为 v0.2 现状，状态口径为“CI 通过、待真机验收”喵～
