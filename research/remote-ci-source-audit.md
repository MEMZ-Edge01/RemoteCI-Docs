# RemoteCI 当前源码与文档站调研审计

> 审计日期：2026-08-11 喵～
>
> 审计边界：本报告只读核对 `D:\Files\Codes\Projects\RemoteCI` 当前工作区，并对照 ClassIsland 官方文档站与官方文档仓库喵～
>
> 重要说明：RemoteCI 当前工作区含大量未提交修改和新增文件，本报告描述的是这份开发中快照，不等同于已发布版本喵～
>
> 本次未运行构建、测试或服务，因为用户明确要求绝对不要修改 `RemoteCI`，而构建会写入 `bin`、`obj` 等目录喵～

## 1. 项目定位

RemoteCI 是面向 ClassIsland 2.x 的课表手表联动系统，由 ClassIsland 插件、ASP.NET Core 中转服务、Wear OS 应用和三端共享协议组成喵～

项目目标是把电脑端 ClassIsland 的课程状态推送到手表，使手表能够显示当前课程、下一节课程、时间与连接状态，并将经过授权的控制请求反向发送到 ClassIsland 插件喵～

源码同时设计了局域网直连与云端中转两条链路，局域网由插件监听 WebSocket，云端链路由插件与手表分别连接 RemoteCI Server 喵～

来源如下喵～

- 项目自述与 monorepo 分工见 `D:\Files\Codes\Projects\RemoteCI\README.md:1-15` 喵～
- 双链路架构图和原始设计目标见 `D:\Files\Codes\Projects\RemoteCI\README.md:17-32` 喵～
- 服务编排会按设置启用 LAN Server、Cloud Client 与状态收集器，见 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\Services\RemoteCiService.cs:36-62` 喵～
- 插件清单声明当前版本为 `0.1.0.0`，并注明 ClassIsland 插件 API `2.0.0.0`，见 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\manifest.yml:1-8` 喵～
- Wear OS 应用版本为 `0.1.0`、最低 API 30、目标 API 37，见 `D:\Files\Codes\Projects\RemoteCI\wearos\app\build.gradle.kts:8-19` 喵～

## 2. 当前源码体现的核心功能

### 2.1 课表状态与通知

- 共享状态快照包含日期、当前课程、下一节课程、课程状态、时间布局、方案名称、上下课剩余时间和生成时间，见 `D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Models\ClassStateSnapshot.cs:5-45` 喵～
- 服务端接受插件的状态、七日课表与课程事件并转发给在线手表，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\WebSocketHub.cs:97-130` 喵～
- Wear OS 主页展示课程状态，并把实时快照落入本地缓存以便无实时数据时显示上次状态，见 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\ui\RemoteCiApp.kt:47-75` 喵～
- Wear OS 收到课程事件后调用系统通知能力，应用清单申请了网络、振动和通知权限，见 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\ui\RemoteCiApp.kt:86-91` 与 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\AndroidManifest.xml:4-16` 喵～

### 2.2 局域网优先与云端回退

- 手表连接管理器先尝试 `ws://<局域网主机>:<端口>/ws`，失败后再登录云端并连接云端 WebSocket，见 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\data\ConnectionManager.kt:55-96` 喵～
- 插件 LAN 服务默认监听所有网卡的 `8765` 端口，只接受 `/ws` 路径，见 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\Services\LanServer.cs:36-47` 与 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\Services\LanServer.cs:62-70` 喵～
- 插件云端客户端设计为断线后每 5 秒重连，并通过 WebSocket 推送状态和事件，见 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\Services\CloudClient.cs:12-18` 与 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\Services\CloudClient.cs:54-80` 喵～

### 2.3 账号、权限和设备会话

- 服务端使用 ASP.NET Core Identity 与 SQLite，密码最低长度为 8，连续失败锁定阈值为 8 次，锁定时间为 10 分钟，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:13-29` 喵～
- 权限模型包含查看当前课程、访问 Web 管理界面、管理用户、发送通知和管理课表，管理员具有全部权限，见 `D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Protocol.cs:29-57` 喵～
- 服务端提供登录、令牌续期、查看本人、修改密码、列出和撤销设备会话、用户增删改与重置密码等 API，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:85-148` 与 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:180-239` 喵～
- 首次启动会创建管理员和一次性插件配对码，未显式配置时会随机生成并写入服务日志，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Services\IdentityCoordinator.cs:24-62` 喵～
- 访问令牌默认有效 1 小时，设备会话默认有效 30 天，插件配对码默认有效 10 分钟，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Services\ServerOptions.cs:3-13` 喵～

### 2.4 课程控制

- 当前 C# 共享协议把控制命令分为课表变更与发送通知，课表变更支持交换和替换，见 `D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Protocol.cs:84-94` 喵～
- 课表变更请求带日期、模式、来源课序、目标课序或替代科目以及预期 revision，用于检测过期课表，见 `D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Models\ScheduleModels.cs:71-92` 喵～
- 服务端对控制请求检查 `ManageSchedule` 或 `SendNotifications` 权限，等待插件最多 15 秒并把插件离线、超时、禁止和 revision 冲突映射为对应 HTTP 状态，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:166-177` 与 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:287-295` 喵～

### 2.5 服务端管理界面

- `wwwroot/index.html` 已设计登录、运行状态、账号管理、新建账号、发送通知、编辑账号和重置密码界面，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\wwwroot\index.html:10-85` 喵～
- 服务端状态 API 返回插件在线状态、插件和手表连接数、账号数、最近状态时间、最近课表时间与协议版本，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:250-267` 喵～
- 该管理界面目前存在接口与托管映射不一致，不能在文档中宣称已经可用，具体问题见第 6 节喵～

## 3. 安装与使用文档应覆盖的流程

### 3.1 面向普通用户的最短路径

1. 安装兼容 ClassIsland 2.x 的 RemoteCI 插件包，并在 ClassIsland 插件设置中打开 RemoteCI 设置页喵～
2. 若只使用同一局域网，启用局域网服务并确认端口，默认值为 `8765` 喵～
3. 若跨网络使用，先部署 RemoteCI Server，再在插件中填写服务地址并使用服务端生成的一次性插件配对码完成配对喵～
4. 在 Wear OS 应用中填写用户账号、密码、云端服务地址或电脑局域网 IP，然后保存并连接喵～
5. 首次连接后确认主页能显示当前课程与下一节课程，再分别验证上课或下课通知、课表交换或替换以及断网后的回退行为喵～

插件设置页面当前公开的字段是启用局域网、局域网端口、启用云端、云端地址和配对码，保存后提示重启 ClassIsland 生效，见 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\Views\SettingsPages\RemoteCiSettingsPage.cs:27-39` 与 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\Views\SettingsPages\RemoteCiSettingsPage.cs:78-97` 喵～

Wear OS 设置持久化的字段是用户名、是否启用云端、云端地址、是否启用局域网、局域网主机和局域网端口，默认云端地址 `http://10.0.2.2:8080` 仅适用于 Android 模拟器访问宿主机，见 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\data\SettingsStore.kt:7-38` 喵～

### 3.2 开发构建信息

当前源码目标是 .NET 10，服务端项目明确使用 `net10.0`，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\RemoteCI.Server.csproj:1-9` 喵～

README 给出的开发命令是 `dotnet build server/RemoteCI.Server`、`dotnet build plugin/RemoteCI.Plugin`，Wear OS 可用 Android Studio 打开 `wearos`，见 `D:\Files\Codes\Projects\RemoteCI\README.md:34-54` 喵～

现有平台笔记记录了本地调试、模拟器和 cipx 打包命令，但其中包含特定开发机的绝对路径，因此文档站应只保留通用步骤，不应照抄机器专用环境，见 `D:\Files\Codes\Projects\RemoteCI\docs\platform-notes.md:5-62` 与 `D:\Files\Codes\Projects\RemoteCI\docs\platform-notes.md:95-133` 喵～

## 4. 服务端部署文档应覆盖的内容

### 4.1 当前可从源码确认的 Docker 基线

服务端 Dockerfile 使用 .NET 10 SDK 多阶段发布，再以 ASP.NET Core 10 Runtime 运行，暴露并监听 `8080`，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Dockerfile:1-15` 喵～

从 monorepo 根目录构建镜像时可使用下面的基线命令，因为 Dockerfile 会同时复制 `shared` 和 `server` 目录喵～

```powershell
docker build -f server/RemoteCI.Server/Dockerfile -t remoteci-server .
```

生产运行至少应把容器内数据库目录 `/app/data` 挂载为持久卷，并通过环境变量设置管理员密码和插件配对码喵～

下面是依据当前源码推导出的部署示例，尚未由仓库内现成 Compose 文件验证喵～

```yaml
services:
  remoteci:
    build:
      context: .
      dockerfile: server/RemoteCI.Server/Dockerfile
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    environment:
      REMOTECI_ADMIN_PASSWORD: "请替换为至少 8 位的强密码"
      REMOTECI_PLUGIN_PAIR_CODE: "请替换为一次性配对码"
    restart: unless-stopped
```

### 4.2 生产部署必须讲清的事项

- 数据库默认写入内容根目录下的 `data/remoteci.db`，必须做持久化挂载和备份，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\appsettings.json:2-9` 与 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:13-16` 喵～
- 首次启动的管理员密码和插件一次性配对码可能只出现在日志中，部署文档必须指导用户立即保存并更换管理员密码，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Services\IdentityCoordinator.cs:33-62` 喵～
- 服务端提供 `/api/health` 健康检查端点，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:267-268` 喵～
- WebSocket 与 REST 共用同一站点，因此反向代理必须允许 `/ws` 升级连接并透传 `X-Forwarded-For` 与 `X-Forwarded-Proto` 喵～
- 非开发环境会启用 HSTS 与 HTTPS 重定向，反向代理配置错误可能造成重定向循环，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:47-61` 喵～
- 生产环境不应直接暴露明文 HTTP，尤其登录、设备令牌和插件配对都依赖网络传输，建议由 Caddy、Nginx 或同类反向代理终止 HTTPS 喵～
- 当前 Dockerfile 没有声明数据卷、容器级健康检查、非 root 用户或 Compose 编排，所以这些必须在部署文档中标为运维补充，而不能冒充仓库现有能力喵～

## 5. 配置项清单

### 5.1 服务端配置

| 配置键或环境变量 | 默认值 | 用途与注意事项 |
| --- | --- | --- |
| `Urls` | `http://0.0.0.0:8080` | Kestrel 监听地址和端口喵～ |
| `Server:DatabasePath` | `data/remoteci.db` | SQLite 数据库路径，容器中应持久化喵～ |
| `Server:BootstrapAdminUsername` | `admin` | 仅首次创建管理员时使用喵～ |
| `Server:BootstrapAdminPassword` | 空 | 可从配置注入，但优先级低于环境变量喵～ |
| `REMOTECI_ADMIN_PASSWORD` | 空 | 首次启动管理员密码，空缺时随机生成并输出到日志喵～ |
| `Server:BootstrapPluginPairCode` | 空 | 可从配置注入的一次性插件配对码喵～ |
| `REMOTECI_PLUGIN_PAIR_CODE` | 空 | 首次启动插件配对码，空缺时随机生成并输出到日志喵～ |
| `Server:AccessTokenTtl` | `01:00:00` | 访问令牌有效期喵～ |
| `Server:DeviceSessionTtl` | `30.00:00:00` | 可续期设备会话有效期喵～ |
| `Server:PluginPairingCodeTtl` | `00:10:00` | 插件一次性配对码有效期喵～ |

服务端默认值来源见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\appsettings.json:1-15` 与 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Services\ServerOptions.cs:3-13` 喵～

### 5.2 插件配置

| 字段 | 默认值 | 用途与注意事项 |
| --- | --- | --- |
| `EnableLanServer` | `true` | 是否启用同 Wi-Fi 的局域网直连喵～ |
| `LanServerPort` | `8765` | 插件 WebSocket 监听端口喵～ |
| `EnableCloud` | `true` | 是否连接云端中转服务喵～ |
| `CloudServerUrl` | `http://localhost:8080` | 云端服务根地址，生产环境应使用 HTTPS 喵～ |
| `PairCode` | `remoteci-demo` | 当前源码默认值与服务端随机一次性配对码机制冲突，不应照用喵～ |
| `CloudToken` | 空 | 配对后缓存的插件令牌，不应由用户手工填写或公开喵～ |

插件字段与默认值来源见 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\Settings\PluginSettings.cs:6-59` 喵～

### 5.3 Wear OS 配置

| 字段 | 默认值 | 用途与注意事项 |
| --- | --- | --- |
| `username` | 空 | 登录 RemoteCI 的用户账号喵～ |
| `cloudConnectionEnabled` | `true` | 是否允许云端中转喵～ |
| `cloudServerUrl` | `http://10.0.2.2:8080` | 模拟器默认地址，真机必须改成实际服务器地址喵～ |
| `lanConnectionEnabled` | `true` | 是否优先尝试局域网连接喵～ |
| `lanHost` | 空 | 运行 ClassIsland 插件的电脑局域网 IP 或主机名喵～ |
| `lanPort` | `8765` | 必须与插件监听端口一致喵～ |

Wear OS 配置来源见 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\data\SettingsStore.kt:10-48` 喵～

## 6. 限制、冲突与未确认事项

### 6.1 当前快照存在的明确三端不一致

以下问题有直接源码证据，因此在修复并完成三端测试前，文档站必须把项目标记为开发中，不能发布“完整链路已可用”的教程喵～

- 服务端插件配对端点是 `/api/plugin/pair`，但插件仍请求 `/api/pair`，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:77-83` 与 `D:\Files\Codes\Projects\RemoteCI\plugin\RemoteCI.Plugin\Services\CloudClient.cs:84-99` 喵～
- C# 登录响应字段是 `accessToken`、`accessExpiresAt`、`deviceSessionId` 和 `deviceSecret`，Wear OS 却仍反序列化 `token` 与 `expiresAt`，见 `D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Models\AuthModels.cs:26-45` 与 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\data\Protocol.kt:126-134` 喵～
- C# 协议命令是 `ChangeSchedule=1`、`SendNotification=2`，Wear OS 仍定义旧的切换周次、临时换课和发送通知数值 `1/2/3`，见 `D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Protocol.cs:84-94` 与 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\data\Protocol.kt:34-40` 喵～
- C# 命令载荷使用 `scheduleChange`、`notification` 和独立的 `command_result`，Wear OS 仍使用 `parameters` 与内嵌 `result`，见 `D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Models\Command.cs:5-38` 与 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\data\Protocol.kt:99-112` 喵～
- Wear OS 连接函数当前签名要求 `settings` 与 `password`，但应用根、重试按钮和设置页仍只传 `settings`，见 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\data\ConnectionManager.kt:55-66` 与 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\ui\RemoteCiApp.kt:81-84`、`122-123`、`219-225` 喵～
- C# 快照已经把课程列表拆到 `ScheduleBundle`，Wear OS 仍期待快照内存在 `courses` 和 `subjects`，见 `D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Models\ClassStateSnapshot.cs:5-45`、`D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Models\ScheduleModels.cs:5-18` 与 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\java\com\remoteci\watch\data\Protocol.kt:55-88` 喵～

### 6.2 管理界面当前不可按成品记录

- 静态管理页登录脚本读取 `result.token`，当前服务端实际返回 `accessToken`，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\wwwroot\app.js:12` 与 `D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Models\AuthModels.cs:26-45` 喵～
- 静态管理页向 `/api/admin/notifications` 发送通知，但 `Program.cs` 当前没有映射该端点，页面与后端 API 不一致，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\wwwroot\app.js:16` 与 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:241-268` 喵～
- 服务端调用 `UseStaticFiles`，但没有调用 `UseDefaultFiles` 或把 `/` 映射到 `index.html`，同时 `MapRazorPages` 未见对应 Pages 文件，所以根路径能否进入管理台没有源码保证，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:47-61` 与 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Program.cs:267-269` 喵～

### 6.3 README 与当前源码漂移

- README 链接到并不存在于当前文件清单的 `docs/protocol.md` 与 `docs/deployment.md`，见 `D:\Files\Codes\Projects\RemoteCI\README.md:32-32` 与 `D:\Files\Codes\Projects\RemoteCI\README.md:56-56` 喵～
- README 把服务端描述为 `REST + token` 的 demo 并声称混合链路已打通，但当前工作区已迁移为账号、权限、设备会话与协议 v2，且三端处于不一致状态，见 `D:\Files\Codes\Projects\RemoteCI\README.md:3-5`、`D:\Files\Codes\Projects\RemoteCI\shared\RemoteCI.Shared\Protocol.cs:3-20` 和本节前述证据喵～
- 平台笔记仍称服务端默认配对码为 `remoteci-demo` 并使用旧 `/api/pair` 冒烟测试，而当前服务端会生成一次性插件配对码且端点已经变更，见 `D:\Files\Codes\Projects\RemoteCI\docs\platform-notes.md:110-128` 与 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Services\IdentityCoordinator.cs:55-62` 喵～

### 6.4 运行与发布仍未确认

- 本次没有构建或测试，因此不能确认当前 .NET 方案、cipx 插件包或 Wear OS APK 能成功产出喵～
- 没有安装 ClassIsland 插件、启动服务端或连接 Wear OS 真机，因此不能确认插件加载、局域网认证、云端回退、通知振动与课表修改的端到端行为喵～
- 服务端当前状态和七日课表只保存在内存中，服务重启后会丢失，SQLite 只承载身份和会话数据，见 `D:\Files\Codes\Projects\RemoteCI\server\RemoteCI.Server\Services\StateStore.cs:5-44` 喵～
- Android 清单允许明文流量，便于局域网和模拟器调试，但生产公网部署应使用 HTTPS/WSS，见 `D:\Files\Codes\Projects\RemoteCI\wearos\app\src\main\AndroidManifest.xml:10-16` 喵～
- README 明确把 Tiles、小米 HyperOS 和 watchOS 列为后续迭代，因此不能放入“现有功能”，见 `D:\Files\Codes\Projects\RemoteCI\README.md:3-5` 喵～

## 7. 功能变更与文档同步规则

“以后每次增减功能都同步改动文档站”不能只写成口号，建议在两个仓库同时落实流程约束喵～

### 7.1 RemoteCI 主仓库规则

- PR 模板必须包含“是否影响用户可见功能、配置、API、协议、部署或兼容性”的检查项喵～
- 任一答案为是时，PR 必须附 RemoteCI-Docs 的对应 PR 链接，或明确说明为何无需改文档喵～
- 改动共享协议时，必须同步更新协议参考、三端兼容矩阵与迁移说明喵～
- 改动服务端配置时，必须同步更新配置表、Docker 示例、升级与回滚说明喵～

### 7.2 RemoteCI-Docs 仓库规则

- 文件名使用小写和连字符，正文按受众与任务拆分，避免把所有内容堆在单页喵～
- CI 至少执行 `pnpm install --frozen-lockfile`、`pnpm run docs:build` 和 Markdown lint 喵～
- 文档页面应提供编辑链接、最近更新时间和对应源码版本信息，降低文档与代码漂移风险喵～
- 发布流程应只在文档构建通过后部署 `src/.vuepress/dist` 喵～

## 8. 建站前的内容冻结建议

第一版文档站可以立即搭建 VuePress 骨架，并先发布项目定位、架构、开发中状态、贡献规则和源码可确认的配置参考喵～

安装教程、完整使用教程和生产部署教程应等第 6 节的接口与协议不一致修复，并完成至少一次服务端、插件、Wear OS 三端构建和端到端验收后再从“草稿”转为“稳定”喵～

部署文档中的 Docker Compose、反向代理、备份与恢复命令目前属于依据源码整理出的建议，必须在实际环境执行和验证后再标注为官方可用方案喵～
