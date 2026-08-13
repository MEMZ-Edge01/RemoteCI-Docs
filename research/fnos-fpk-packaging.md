# 飞牛 fnOS 应用（.fpk）打包与发布调研

> 调研时间：2026-08-13。一手来源以飞牛官方开发者文档站为主，社区工程化技能仓库 FNOSP/fnos-developer-skill 与真实 fpk 案例为辅。版本敏感信息（fnpack 版本、系统版本）以官方最新页面为准。

## A. fpk 项目结构

官方 `fnpack create` 生成的项目结构（来源：https://developer.fnnas.com/docs/cli/fnpack/ 、https://developer.fnnas.com/docs/examples/docker/ ）：

```text
myapp/
├── app/
│   ├── ui/
│   │   ├── config
│   │   └── images/
│   └── docker/
│       └── docker-compose.yaml
├── cmd/
│   ├── main
│   ├── install_init
│   ├── install_callback
│   ├── upgrade_init
│   ├── upgrade_callback
│   ├── uninstall_init
│   ├── uninstall_callback
│   ├── config_init
│   └── config_callback
├── config/
│   ├── privilege
│   └── resource
├── wizard/
├── manifest
├── ICON.PNG
└── ICON_256.PNG
```

`fnpack build` 的必检项（来源：https://developer.fnnas.com/docs/cli/fnpack/ ）：

| 路径 | 要求 |
| --- | --- |
| `manifest` | 存在且含必要字段 |
| `config/privilege` | 存在且为合法 JSON |
| `config/resource` | 存在且为合法 JSON |
| `ICON.PNG` | 存在（64×64，来源：https://developer.fnnas.com/docs/core-concepts/icon/ ） |
| `ICON_256.PNG` | 存在（256×256） |
| `app/` | 存在 |
| `cmd/` | 存在 |
| `wizard/` | 存在 |
| `app/{desktop_uidir}/` | 声明 `desktop_uidir` 时必须存在 |

`fnpack build` 产物为 gzip 压缩的 tar，内含 `app.tgz`（app/ 目录）、`cmd/`、`config/`、`manifest`、`ICON.PNG`、`ICON_256.PNG`、`wizard/`，manifest 会被规范化并追加 `checksum` 字段。

## B. manifest 字段

`manifest` 是包根目录下无扩展名的键值文件（非 JSON），字段（来源：https://developer.fnnas.com/docs/core-concepts/manifest/ 、https://developer.fnnas.com/docs/examples/docker/ 、FNOSP/fnos-developer-skill references/package-model.md）：

| 字段 | 含义 | 备注 |
| --- | --- | --- |
| `appname` | 应用唯一标识 | 升级间必须稳定；小写、可含连字符 |
| `version` | 应用版本 | 例如 `1.0.0`、`2.1.3-beta` |
| `display_name` | 用户可见名称 | |
| `desc` | 应用描述 | 允许 HTML |
| `source` | 应用来源 | 第三方应用用 `thirdparty` |
| `platform` | 支持架构 | `x86` / `arm` / `all`；无平台相关二进制才用 `all`，Docker 应用需镜像本身支持目标架构 |
| `maintainer` / `maintainer_url` | 维护者信息 | |
| `distributor` / `distributor_url` | 发布者信息 | 可选 |
| `os_min_version` / `os_max_version` | 系统版本范围 | 按真实兼容性声明 |
| `desktop_uidir` | UI 目录 | 默认 `ui` |
| `desktop_applaunchname` | 应用卡片打开的入口 ID | 官方示例用此字段（`desktop_appname` 是社区旧写法） |
| `service_port` | 宿主机访问端口 | Docker 应用 compose 可用 `${TRIM_SERVICE_PORT}` 引用 |
| `checkport` | 启动前是否检查端口占用 | 默认 `true` |
| `ctl_stop` | 是否显示启动/停止/状态控制 | Docker 应用通常 `true` |
| `install_dep_apps` | 直接依赖 | 多个用 `:`，最低版本用 `>` |
| `micro_app` | 使用开放平台 JS SDK 时设为 `true` | 本调研未使用 |

官方 Docker 案例 manifest（来源：https://developer.fnnas.com/docs/examples/docker/ ）：

```ini
appname=hello-docker
version=1.0.0
display_name=Hello Docker
desc=A minimal Docker application.
source=thirdparty
platform=all
maintainer=Example Team
distributor=Example Team
desktop_uidir=ui
desktop_applaunchname=hello-docker.main
service_port=8080
checkport=true
ctl_stop=true
```

## C. Docker 应用

Docker 应用通过 `config/resource` 的 `docker-project` 声明（来源：https://developer.fnnas.com/docs/core-concepts/resource/ ）：

```json
{
  "docker-project": {
    "projects": [
      {
        "name": "remoteci",
        "path": "docker"
      }
    ]
  }
}
```

- `name`：Compose 项目名，保持稳定。
- `path`：相对 `app/` 的目录，内含 `docker-compose.yaml`。

官方 compose 示例（来源：https://developer.fnnas.com/docs/examples/docker/ ）：

```yaml
services:
  web:
    image: nginx:alpine
    container_name: hello-docker-web
    restart: unless-stopped
    ports:
      - "${TRIM_SERVICE_PORT}:80"
    volumes:
      - "${TRIM_APPDEST}/docker/html:/usr/share/nginx/html:ro"
```

要点：

- Compose 可使用 fnOS 注入的环境变量：`TRIM_SERVICE_PORT`、`TRIM_APPDEST`、`TRIM_PKGVAR`、`TRIM_DATA_SHARE_PATHS` 等（来源：https://developer.fnnas.com/docs/core-concepts/environment-variables/ ）。
- 镜像必须公开可拉取且支持设备架构；`platform=all` 不表示镜像支持所有架构。
- 应用中心管理 Docker 项目的启动/停止/升级；`cmd/main` 的 start/stop 通常直接 `exit 0`，status 通过 `docker inspect <container_name>` 判断（官方明确说明，来源同上）。
- 社区真实案例（Hxido-RXM/fnos-docker 的 emby 包）使用 `container_name`、`trim-default` external 网络、`/var/apps/{appname}/var/...` 与 `/var/apps/{appname}/shares/...` 挂载、`restart: always`。官方推荐优先用 `${TRIM_PKGVAR}` 等变量而不是硬编码路径。

## D. config/privilege 与 config/resource

### privilege

默认最小权限（来源：https://developer.fnnas.com/docs/quick-started/create-application/ 、官方 Docker 案例）：

```json
{
  "defaults": {
    "run-as": "package"
  },
  "username": "remoteci",
  "groupname": "remoteci"
}
```

`run-as: package` 表示用专用应用用户运行。Docker 应用由容器承载主进程，privilege 不用于容器内进程身份，保留 package 即可。

### resource

可声明：`data-share`（共享目录，Windows ACL 模型）、`usr-local-linker`（系统链接）、`docker-project`（Docker 项目）、`api-scope`（开放 API 权限，如 `trim.file.userAccess`、`trim.file.userAcl`、`trim.file.path`、`trim.file.sharedAccess`、`trim.system.getPlatformConfig`）。只声明实际使用的能力。

## E. wizard 用户向导

支持四个文件：`wizard/install`、`wizard/upgrade`、`wizard/uninstall`、`wizard/config`（来源：https://developer.fnnas.com/docs/core-concepts/wizard/ ）。

格式：步骤数组，字段类型含 `text`、`password`、`radio`、`checkbox`、`select`、`switch`、`tips`；`initValue` 为默认值；收集到的值会成为同名环境变量（不加 `TRIM_` 前缀）。

```json
[
  {
    "stepTitle": "Setup",
    "items": [
      {
        "type": "text",
        "field": "wizard_username",
        "label": "Username",
        "initValue": "admin",
        "rules": [
          { "required": true, "message": "Enter a username" }
        ]
      }
    ]
  }
]
```

`app/ui/config` 的入口 `port` 支持 `${wizard_字段名}` 动态引用（来源：https://developer.fnnas.com/docs/core-concepts/app-entry/ ）。

## F. cmd 生命周期脚本

| 脚本 | 时机 |
| --- | --- |
| `install_init` | 安装应用文件前 |
| `install_callback` | 安装应用文件后 |
| `main` | start / stop / status |
| `upgrade_init` / `upgrade_callback` | 升级前 / 升级后 |
| `uninstall_init` / `uninstall_callback` | 卸载前 / 卸载清理后 |
| `config_init` / `config_callback` | 配置变更应用前 / 后 |

要求（来源：https://developer.fnnas.com/docs/core-concepts/environment-variables/ 、FNOSP build-test.md）：

- `status`：运行返回 0，未运行返回 3；普通失败非零。
- 失败时先把清晰错误写入 `TRIM_TEMP_LOGFILE` 再退出非零。
- Docker 应用 start/stop 由应用中心接管，`cmd/main` 只做 status 检查。

## G. fnpack 与 appcenter-cli

- fnpack 下载地址（Linux amd64 为例）：`https://static2.fnnas.com/fnpack/fnpack-1.2.3-linux-amd64`，另有 darwin/arm64/windows 变体；版本以 https://developer.fnnas.com/docs/cli/fnpack/ 页面为准。
- 命令：`fnpack create <appname> [--template docker] [--without-ui true]`、`fnpack build [--directory <path>]`。
- appcenter-cli（在 fnOS 设备上）：`appcenter-cli install-fpk myapp.fpk [--env config.env]`、`list`、`start`、`stop`、`default-volume`（来源：https://developer.fnnas.com/docs/quick-started/test-application/ 、FNOSP build-test.md）。
- 手动安装：应用中心 → 手动安装 → 选择 fpk；仅用于本地测试，不作为公开分发方式。

## H. 应用更新机制

- fnOS 应用中心管理应用升级：新 fpk 安装时运行 upgrade 脚本，Docker 应用会基于新 compose 重建容器并拉取新镜像（官方 Docker 案例说明升级由应用中心处理；未找到单独的应用升级 API 页面）。
- 开放 API 目前聚焦文件授权/ACL/路径/平台配置（`/api/v1/trimapp` + Unix Socket + `TRIM_API_TOKEN`），**没有**"应用自我安装/自我升级"接口（来源：https://developer.fnnas.com/api/overview/ 、FNOSP references/open-api.md）。
- 因此容器内 WebUI 无法直接触发 fpk 安装。该调研最初建议由 WebUI 下载 fpk 后手动确认；RemoteCI v0.3.1 起已改为完全由 fnOS 应用商店检查和升级，WebUI 仅显示托管状态。
- fpk 附件命名官方无强制约定；本仓库统一为 `RemoteCI-<版本>.fpk`。

## I. 发布

- 上架应用中心需准备：fpk 包、应用图标、真实截图；提交通过开发者先锋交流群，开发者后台上线后按平台流程（来源：https://developer.fnnas.com/docs/quick-started/publish-application/ ）。
- fpk 由 fnpack 生成，官方文档未要求开发者签名。
- 图标：包图标 `ICON.PNG`（64×64）与 `ICON_256.PNG`（256×256）；入口图标 `app/ui/images/icon_{0}.png` 可提供多尺寸。

## 来源清单

- https://developer.fnnas.com/docs/cli/fnpack/
- https://developer.fnnas.com/docs/quick-started/create-application/
- https://developer.fnnas.com/docs/quick-started/test-application/
- https://developer.fnnas.com/docs/quick-started/publish-application/
- https://developer.fnnas.com/docs/core-concepts/manifest/
- https://developer.fnnas.com/docs/core-concepts/resource/
- https://developer.fnnas.com/docs/core-concepts/app-entry/
- https://developer.fnnas.com/docs/core-concepts/wizard/
- https://developer.fnnas.com/docs/core-concepts/environment-variables/
- https://developer.fnnas.com/docs/core-concepts/icon/
- https://developer.fnnas.com/docs/examples/docker/
- https://developer.fnnas.com/api/overview/
- https://github.com/FNOSP/fnos-developer-skill （SKILL.md、references/package-model.md、references/build-test.md、references/open-api.md、templates/manifest.template、templates/privilege.package.json、templates/resource.user-files.json）
- https://github.com/Hxido-RXM/fnos-docker （emby 真实 Docker fpk 案例）
