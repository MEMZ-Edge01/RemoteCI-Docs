---
title: 开发 RemoteCI 扩展
icon: puzzle-piece
order: 3
---

# 开发 RemoteCI 扩展

RemoteCI 插件公开了一组扩展接口，其他 ClassIsland 插件可以把自定义远程功能注册进来。功能会自动出现在手表控制页底部，点击后由注册方回调执行。

## 扩展接口

- <code>IRemoteCiExtension</code>：功能定义（Id、DisplayName、RequiredPermission，可选 Icon 与 Parameters，以及 ExecuteAsync 执行回调）。
- <code>IRemoteCiExtensionRegistry</code>：注册、注销、查询与变更事件；RemoteCI 已注册为单例服务。
- <code>RemoteCiExtensionBase</code>：推荐基类，只需实现核心成员，其余按无图标、无参数处理。

其他插件项目需在编译期引用 <code>RemoteCI.Plugin.dll</code>，并在 ClassIsland <code>AppStarted</code> 之后获取注册表（此时主机容器已构建完成）：

```csharp
using ClassIsland.Shared;
using RemoteCI.Plugin.Extensions;
using RemoteCI.Shared;
using RemoteCI.Shared.Models;

public sealed class LockScreenExtension : RemoteCiExtensionBase
{
    public override string Id => "myplugin.lock";
    public override string DisplayName => "锁屏";
    public override UserPermissions RequiredPermission => UserPermissions.SystemControl;
    public override string? Icon => "power";

    public override Task<CommandResult> ExecuteAsync(
        ExtensionExecutionContext context,
        IReadOnlyDictionary<string, string?> args,
        CancellationToken cancellationToken)
    {
        // context.RequestedBy 是已认证的发起用户，可在这里执行远程功能。
        return Task.FromResult(new CommandResult
        {
            Success = true,
            Code = CommandResultCodes.Ok,
            Message = "已锁屏",
        });
    }
}

// 插件入口的 AppStarted 事件中注册：
var registry = IAppHost.GetService<IRemoteCiExtensionRegistry>();
registry?.Register(new LockScreenExtension());
```

## 参数表单

扩展可声明 <code>Parameters</code> 列表，手表会按 schema 渲染参数输入页，用户填写后以 <code>extensionArgs</code> 字典传入 <code>ExecuteAsync</code>（键为参数 Key，值统一为字符串）：

| 类型 | 手表呈现 |
| --- | --- |
| <code>Text</code> | 单行文本输入 |
| <code>Number</code> | 数字输入 |
| <code>Switch</code> | 开关（值为 "true"/"false"） |
| <code>Select</code> | 候选项循环切换（需提供 Options） |

```csharp
public override IReadOnlyList<ExtensionParameter> Parameters => new[]
{
    new ExtensionParameter
    {
        Key = "message",
        Label = "通知内容",
        Type = ExtensionParameterType.Text,
        Required = true,
        DefaultValue = "下课了",
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
```

## 安全边界

- 手表端按当前用户有效权限隐藏入口，插件执行端会再次校验 RequiredPermission；隐藏按钮不构成安全控制。
- 授权镜像超过 24 小时未更新时，局域网直连会拒绝执行任何扩展命令。
- <code>ExecuteAsync</code> 抛出的异常统一转换为 <code>INTERNAL_ERROR</code> 回执，不会中断 RemoteCI 插件。
- 服务端只要求已认证用户，所需权限由插件端按注册项动态校验；未注册、缺少必填参数或权限不足时分别返回 <code>INVALID_REQUEST</code> / <code>FORBIDDEN</code>。
