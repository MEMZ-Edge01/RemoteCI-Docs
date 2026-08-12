---
title: 接入扩展
icon: puzzle-piece
order: 1
---

# 接入扩展

RemoteCI 插件公开了一组扩展接口：其他 ClassIsland 插件可以把自定义的“远程功能”注册进来，注册后该功能会自动出现在手表控制页底部，点击后由注册方自己的回调执行。

本文面向想把手表变成自己插件遥控器的开发者，覆盖完整开发流程、接口参考、参数表单、安全边界与常见问题。示例代码均对照 RemoteCI 当前源码整理，可直接复制到自己的插件项目中。

## 能做什么

扩展接口适合把“只有你的插件能做的事”带到手表上，例如：

- 锁屏、休眠、重启或退出某个程序；
- 显示自定义提醒或触发你的插件自己的通知；
- 切换插件内部的某个开关（如“进入专注模式”）；
- 查看插件特有的状态并展示给用户。

不需要扩展接口的场景：RemoteCI 已经内置换课、发送通知、清除提醒、主界面显隐、音量与电源控制，不要重复注册同类型功能。

## 工作流程

一次扩展点击的完整链路如下：

1. 你的插件在 ClassIsland 启动完成（`AppStarted`）后，从主机容器取得 `IRemoteCiExtensionRegistry` 并注册扩展。
2. RemoteCI 插件监听注册表变化，把扩展清单通过 `extensions_sync` 同步给局域网手表和云端服务端。
3. 手表收到清单后，在“控制”页底部按当前用户的有效权限显示入口。
4. 点击无参数扩展立即发送 `RunExtension` 命令；有参数扩展先进入参数表单，填写后发送。
5. RemoteCI 插件执行端校验权限与必填参数，调用你的 `ExecuteAsync`。
6. 你返回 `CommandResult`，RemoteCI 把它作为回执传回手表并显示结果。

整个流程中，RemoteCI 只负责“同步清单、转发命令、传回回执”，功能本身始终由你的代码实现。

## 前置条件

- 你的项目是 ClassIsland 2.x 插件，目标框架为 .NET 8。
- RemoteCI 插件已安装，并且至少成功连接过一次（云端或局域网均可）。
- 编译期引用 `RemoteCI.Plugin.dll`。
- 在 `AppStarted` 之后注册扩展，因为此时 ClassIsland 主机容器才构建完成，才能取到注册表服务。

::: tip 运行时兼容
`RemoteCI.Plugin.dll` 运行时由 RemoteCI 插件自身提供，你的插件包内不需要携带它，只需保证编译期引用，避免类型冲突。
:::

## 完整示例

下面用一个最小但完整的插件演示接入过程：注册一个“锁屏”按钮，再注册一个带参数表单的“自定义提醒”。

### 1. 项目结构与引用

建议的目录结构：

~~~text
MyClassIslandPlugin/
├─ MyClassIslandPlugin.csproj
├─ Extensions/
│  ├─ LockScreenExtension.cs      # 无参数扩展
│  ├─ CustomReminderExtension.cs  # 带参数扩展
│  └─ MyPluginEntry.cs            # 插件入口，负责注册
└─ libs/
   └─ RemoteCI.Plugin.dll         # 编译期引用
~~~

`RemoteCI.Plugin.dll` 可以从 RemoteCI 的 Release 插件包（CIPX）中解出，也可以从源码构建后从输出目录复制。在 csproj 中添加引用：

~~~xml
<ItemGroup>
  <Reference Include="RemoteCI.Plugin">
    <HintPath>..\libs\RemoteCI.Plugin.dll</HintPath>
    <Private>false</Private>
  </Reference>
</ItemGroup>
~~~

`Private=false` 表示不复制到输出目录，运行时统一使用 RemoteCI 插件加载的程序集。

### 2. 定义无参数扩展（锁屏）

继承 `RemoteCiExtensionBase` 即可，只需要实现四个核心成员：

~~~csharp
using RemoteCI.Plugin.Extensions;
using RemoteCI.Shared;
using RemoteCI.Shared.Models;

namespace MyClassIslandPlugin.Extensions;

/// <summary>在手表控制页注册一个“锁屏”按钮。</summary>
public sealed class LockScreenExtension : RemoteCiExtensionBase
{
    /// <summary>全局唯一 Id，命令路由和去重都使用它。</summary>
    public override string Id => "myplugin.lock_screen";

    /// <summary>手表控制菜单上显示的文案。</summary>
    public override string DisplayName => "锁屏";

    /// <summary>执行所需的最小权限；手表显示与插件执行端都会校验。</summary>
    public override UserPermissions RequiredPermission => UserPermissions.SystemControl;

    /// <summary>可选 Material 图标名；未命中手表白名单时回退为纯文字。</summary>
    public override string? Icon => "power";

    public override Task<CommandResult> ExecuteAsync(
        ExtensionExecutionContext context,
        IReadOnlyDictionary<string, string?> args,
        CancellationToken cancellationToken)
    {
        // context.RequestedBy 是已经过认证的发起用户，可在这里做审计或附加校验。
        // 在这里调用你自己的锁屏实现（例如系统 API）。
        return Task.FromResult(new CommandResult
        {
            Success = true,
            Code = CommandResultCodes.Ok,
            Message = "已锁屏",
        });
    }
}
~~~

### 3. 定义带参数扩展（自定义提醒）

参数通过 `Parameters` 声明，手表会按 schema 渲染表单；用户提交后以 `args` 字典传入 `ExecuteAsync`：

~~~csharp
using RemoteCI.Plugin.Extensions;
using RemoteCI.Shared;
using RemoteCI.Shared.Models;

namespace MyClassIslandPlugin.Extensions;

/// <summary>在手表上填写内容后，触发你插件自己的提醒功能。</summary>
public sealed class CustomReminderExtension : RemoteCiExtensionBase
{
    public override string Id => "myplugin.reminder";
    public override string DisplayName => "自定义提醒";
    public override UserPermissions RequiredPermission => UserPermissions.SendNotifications;

    public override IReadOnlyList<ExtensionParameter> Parameters => new[]
    {
        new ExtensionParameter
        {
            Key = "message",
            Label = "提醒内容",
            Type = ExtensionParameterType.Text,
            Required = true,
            DefaultValue = "该喝水了",
        },
        new ExtensionParameter
        {
            Key = "urgent",
            Label = "紧急",
            Type = ExtensionParameterType.Switch,
            DefaultValue = "false",
        },
        new ExtensionParameter
        {
            Key = "voice",
            Label = "播报音色",
            Type = ExtensionParameterType.Select,
            Options = ["标准", "柔和"],
        },
    };

    public override async Task<CommandResult> ExecuteAsync(
        ExtensionExecutionContext context,
        IReadOnlyDictionary<string, string?> args,
        CancellationToken cancellationToken)
    {
        // 必填参数由 RemoteCI 执行端校验，这里可以假定 message 非空。
        var message = args.GetValueOrDefault("message") ?? "提醒";
        var urgent = args.GetValueOrDefault("urgent") == "true";
        var voice = args.GetValueOrDefault("voice") ?? "标准";

        // 在这里调用你自己的提醒/播报实现。
        await Task.Delay(TimeSpan.FromMilliseconds(100), cancellationToken);

        return new CommandResult
        {
            Success = true,
            Code = CommandResultCodes.Ok,
            Message = urgent ? $"[紧急] {message}（{voice}）" : message,
        };
    }
}
~~~

### 4. 在插件入口注册

在 `AppStarted` 之后注册，`AppStopping` 时注销：

~~~csharp
using ClassIsland.Core;
using ClassIsland.Core.Abstractions;
using ClassIsland.Core.Attributes;
using ClassIsland.Shared;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MyClassIslandPlugin.Extensions;
using RemoteCI.Plugin.Extensions;

namespace MyClassIslandPlugin;

[PluginEntrance]
public class MyPluginEntry : PluginBase
{
    public override void Initialize(HostBuilderContext context, IServiceCollection services)
    {
        var app = AppBase.Current;

        // RemoteCI 在宿主容器中注册了单例注册表，AppStarted 之后才能安全获取。
        app.AppStarted += (_, _) =>
        {
            var registry = IAppHost.GetService<IRemoteCiExtensionRegistry>();
            registry?.Register(new LockScreenExtension());
            registry?.Register(new CustomReminderExtension());
        };

        app.AppStopping += (_, _) =>
        {
            var registry = IAppHost.GetService<IRemoteCiExtensionRegistry>();
            registry?.Unregister("myplugin.lock_screen");
            registry?.Unregister("myplugin.reminder");
        };
    }
}
~~~

### 5. 验证

1. 编译插件并安装到 ClassIsland，重启 ClassIsland。
2. 确认 RemoteCI 设置中连接正常，手表控制页能看到课程状态。
3. 打开手表“控制”页，底部应出现“锁屏”和“自定义提醒”两个入口。
4. 点击“锁屏”应直接执行并收到“已锁屏”回执；点击“自定义提醒”应进入参数表单，填写后执行。
5. 修改权限或注销后，入口应立即从手表消失（清单会重新同步）。

::: warning 权限影响可见性
手表端按当前用户的有效权限过滤入口。测试时如果看不到按钮，请确认当前账号有 `SystemControl` / `SendNotifications` 权限，或使用管理员账号。
:::

## 接口参考

### IRemoteCiExtension

扩展功能定义接口，所有成员都需要实现（推荐继承 `RemoteCiExtensionBase` 减少样板代码）：

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `Id` | `string` | 全局唯一扩展 Id；与已有注册项冲突时 `Register` 会抛出异常 |
| `DisplayName` | `string` | 手表控制菜单展示的文案 |
| `RequiredPermission` | `UserPermissions` | 执行所需的最小权限；手表显示与插件执行端都会校验 |
| `Icon` | `string?` | 可选 Material 图标名；未知或缺失时手表回退为纯文字 |
| `Parameters` | `IReadOnlyList<ExtensionParameter>` | 可选参数表单描述；为空时点击后直接执行 |
| `ExecuteAsync` | 方法 | 执行远程功能；异常统一由 RemoteCI 转为 `INTERNAL_ERROR` 回执 |

### IRemoteCiExtensionRegistry

RemoteCI 插件把它注册为 ClassIsland 主机容器的单例服务，可通过 `IAppHost.GetService<IRemoteCiExtensionRegistry>()` 获取：

| 成员 | 说明 |
| --- | --- |
| `GetExtensions()` | 返回当前全部已注册扩展的快照 |
| `Register(extension)` | 注册扩展；`Id` 已存在时抛出 `InvalidOperationException` |
| `Unregister(id)` | 按 `Id` 注销，返回是否成功移除 |
| `ExtensionsChanged` | 注册/注销后触发，RemoteCI 会重新广播扩展清单 |

### RemoteCiExtensionBase

推荐基类：只需要实现 `Id`、`DisplayName`、`RequiredPermission` 与 `ExecuteAsync`，其余成员按“无图标、无参数”处理。

### ExtensionExecutionContext

执行上下文，包含发起本次执行的已认证用户，供审计或附加校验：

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `RequestedBy` | `UserProfile` | 已认证的发起用户（权限已经校验过声明的最小权限） |
| `Timestamp` | `DateTimeOffset` | 插件执行端收到命令的时间 |

`UserProfile` 包含 `Id`、`Username`、`DisplayName`、`Role` 与 `Permissions` 等字段。

### CommandResult 与回执码

`ExecuteAsync` 必须返回 `CommandResult`。`Message` 会展示在手表上，因此建议写用户能看懂的结果文案。

常用回执码：

| 回执码 | 含义 |
| --- | --- |
| `OK` | 执行成功 |
| `INVALID_REQUEST` | 扩展 Id 未注册、缺少必填参数或命令格式无效 |
| `FORBIDDEN` | 当前用户权限不足 |
| `PLUGIN_OFFLINE` | 插件未在线，操作未执行 |
| `COMMAND_TIMEOUT` | 等待插件回执超时，操作结果未知 |
| `INTERNAL_ERROR` | `ExecuteAsync` 抛出异常或返回 `null` |

### UserPermissions 权限位

有效权限是位掩码，管理员固定为全部权限：

| 值 | 权限 |
| --- | --- |
| 1 | 查看当前课程 |
| 2 | WebUI 访问 |
| 4 | 人员管理 |
| 8 | 发送与清除通知 |
| 16 | 换课 |
| 32 | 主界面与电源控制 |

选择 `RequiredPermission` 时按实际操作强度决定：只读操作可用 `ViewCurrentCourse`，写操作建议 `SendNotifications`（通知类）或 `SystemControl`（系统控制类）。

## 参数表单

扩展可声明 `Parameters` 列表，手表按 schema 渲染参数输入页，用户填写后以 `extensionArgs` 字典传入 `ExecuteAsync`（键为参数 `Key`，值统一为字符串）：

| 类型 | 手表呈现 |
| --- | --- |
| `Text` | 单行文本输入 |
| `Number` | 数字输入 |
| `Switch` | 开关（值为 `"true"` / `"false"`） |
| `Select` | 候选项循环切换（需提供 `Options`） |

交互细节：

- 无参数扩展：点击后直接执行，不经过表单页。
- 有参数扩展：点击后进入参数表单，点击“执行”才发送命令。
- `Switch` 的初始值：`DefaultValue` 为 `"true"` 时是开，否则一律为关。
- `Select` 的候选项点击后循环切换；当前值不在候选项中时从第一项开始。
- `Required = true` 的参数未填写时，RemoteCI 执行端会直接返回 `INVALID_REQUEST`，不会调用你的 `ExecuteAsync`。
- 所有值统一按字符串传输；`Number` 类型需要你在 `ExecuteAsync` 里自己解析（如 `int.Parse`），并注意值可能为 `null`。

## 安全边界

- 手表端按当前用户有效权限隐藏入口，但隐藏按钮不构成安全控制；插件执行端会对每个 `RunExtension` 命令再次校验 `RequiredPermission`。
- `RunExtension` 命令在服务端只要求“已认证用户”，所需权限由插件端按注册项动态校验。
- 未注册的扩展 Id 返回 `INVALID_REQUEST`；权限不足返回 `FORBIDDEN`；缺少必填参数返回 `INVALID_REQUEST`。
- 授权镜像超过 24 小时未更新时，局域网直连会拒绝执行任何扩展命令。
- `ExecuteAsync` 抛出的异常统一转换为 `INTERNAL_ERROR` 回执，不会中断 RemoteCI 插件。
- 建议在 `ExecuteAsync` 中用 `context.RequestedBy` 记录审计日志；不要在扩展中保存用户密码、令牌等敏感数据。

## 注意事项与最佳实践

- `Id` 必须全局唯一且稳定，不要使用 `DisplayName` 或易变字符串；修改 `Id` 后旧入口会失效，且可能与其他插件冲突。
- 扩展注册一次即可，不要在每次执行时重复注册。
- `ExecuteAsync` 应尽快返回：RemoteCI 等待插件回执有上限，超时会返回 `COMMAND_TIMEOUT`，操作结果未知。
- 参数解析要防御 `null`，使用 `args.GetValueOrDefault(key)` 并给出兜底值。
- 插件更新时尽量保持接口兼容，避免因为 `RemoteCI.Plugin.dll` 版本不一致导致扩展不可用。
- 与 RemoteCI 内置命令同类型的操作不要重复注册，避免手表菜单冗余。

## 常见问题排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 手表看不到扩展入口 | 清单未同步、当前用户权限不足、插件未连接 | 重启 ClassIsland；确认账号权限；确认 RemoteCI 连接正常 |
| 点击后提示 `FORBIDDEN` | 当前用户权限不足 | 在服务端人员管理里授予对应权限 |
| 提示 `INVALID_REQUEST` | 扩展 Id 未注册或缺少必填参数 | 检查插件是否加载了注册代码；检查参数表单填写 |
| 提示 `INTERNAL_ERROR` | `ExecuteAsync` 抛出了异常 | 查看 ClassIsland 日志中的 `RemoteCI 扩展执行失败` 记录 |
| 提示 `COMMAND_TIMEOUT` | 执行时间超过回执等待上限 | 缩短执行时间，或把耗时操作改为异步任务后立即返回 |
| 注册时抛出“扩展 Id 已存在” | `Id` 与其他插件冲突 | 修改为全局唯一的 `Id` |

## 相关页面

- [项目架构](../development/architecture.md)：协议 v2 数据流与命令编号。
- [文档同步规则](../development/docs-maintenance.md)：功能变更时的文档同步要求。
- [使用文档](../guide/features.md)：手表端扩展入口的实际使用方式。
