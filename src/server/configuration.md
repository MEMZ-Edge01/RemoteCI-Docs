---
title: 配置参考
icon: sliders
order: 2
---

# 配置参考

服务端使用 ASP.NET Core 标准配置系统。JSON 中的层级键可用双下划线转换为环境变量，例如 <code>Server:DatabasePath</code> 对应 <code>Server__DatabasePath</code>。

## 监听地址

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| <code>Urls</code> | <code>http://0.0.0.0:8080</code> | 服务端监听地址 |
| <code>ASPNETCORE_URLS</code> | 镜像内为 <code>http://0.0.0.0:8080</code> | 使用环境变量覆盖监听地址 |

## Server 配置

| JSON 键 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- |
| <code>Server:DatabasePath</code> | <code>Server__DatabasePath</code> | <code>data/remoteci.db</code> | SQLite 数据库路径 |
| <code>Server:BootstrapAdminUsername</code> | <code>Server__BootstrapAdminUsername</code> | <code>admin</code> | 首次启动创建的管理员用户名 |
| <code>Server:BootstrapAdminPassword</code> | <code>Server__BootstrapAdminPassword</code> | 自动生成 | 首次启动管理员密码 |
| <code>Server:BootstrapPluginPairCode</code> | <code>Server__BootstrapPluginPairCode</code> | 自动生成 | 首次启动插件配对码 |
| <code>Server:AccessTokenTtl</code> | <code>Server__AccessTokenTtl</code> | <code>01:00:00</code> | 短期访问令牌有效期 |
| <code>Server:DeviceSessionTtl</code> | <code>Server__DeviceSessionTtl</code> | <code>30.00:00:00</code> | 设备会话有效期 |

另有两个优先级更高、便于容器首次启动的环境变量：

- <code>REMOTECI_ADMIN_PASSWORD</code>：首次管理员密码。
- <code>REMOTECI_PLUGIN_PAIR_CODE</code>：首次一次性插件配对码。

这些初始值只在数据库中没有对应数据时使用。修改已经运行过的容器环境变量，不会覆盖现有管理员密码或重新生成插件凭据。

插件配对码在使用前持续有效，成功配对后立即作废。需要新配对码时，登录 WebUI 在概览页点击“生成插件配对码”。

## 时间格式

配置中的时长使用 .NET <code>TimeSpan</code> 格式：

- <code>01:00:00</code> 表示 1 小时。
- <code>30.00:00:00</code> 表示 30 天。

## 插件默认配置

插件设置保存在 ClassIsland 插件配置目录的 <code>Settings.json</code>，界面可修改：

| 配置 | 默认值 |
| --- | --- |
| 启用局域网服务 | 是 |
| 局域网端口 | <code>8765</code> |
| 启用云端中转 | 是 |
| 云端地址 | <code>http://localhost:8080</code> |
| 配对码 | 留空；配对时填写一次性配对码，成功后自动清空 |

保存后需要重启 ClassIsland 才会重新创建连接。

## 手表端默认配置

连接设置：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| ID（username） | 空 | 服务端创建的登录 ID |
| 启用云端连接 | 是 | 允许连接云端服务端 |
| 云端地址 | <code>http://10.0.2.2:8080</code> | 仅 Android 模拟器默认可用，真机必须改为实际地址 |
| 启用局域网连接 | 是 | 优先尝试局域网直连 |
| 局域网主机 | 空 | 运行插件的电脑 IP 或主机名 |
| 局域网端口 | <code>8765</code> | 必须与插件监听端口一致 |

通知开关（默认全部开启）：

| 开关 | 对应事件 |
| --- | --- |
| 上课 | 上课事件 |
| 课间 | 课间事件 |
| 放学 | 放学事件 |
| 课表变更 | 课表变更事件 |
| 自定义消息 | 自定义通知事件 |
| 自动化通知 | ClassIsland 自动化“显示提醒”事件 |
| 插件通知 | 第三方 ClassIsland 插件通知事件 |
