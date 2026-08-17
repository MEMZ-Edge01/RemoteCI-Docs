---
title: 飞牛 fnOS 安装
icon: box
order: 4
---

# 飞牛 fnOS 安装

RemoteCI 以飞牛 fnOS 应用（`.fpk`）形式发布，采用 Docker 应用形态：容器内运行 RemoteCI WebUI，数据保存在 fnOS 数据卷，可由应用中心统一管理启动、停止和升级。

## 安装包与镜像

每个 GitHub Release 都会附带：

- `RemoteCI-<版本>.fpk`：飞牛 fnOS 应用安装包。
- `ghcr.io/memz-edge01/remoteci:<版本>`：多架构 Docker 镜像（linux/amd64 与 linux/arm64），由发布流水线自动构建并推送。

镜像包在首次发布后需在 GitHub 仓库的 Packages 设置中确认可见性为 Public，否则 fnOS 无法匿名拉取。

## 安装步骤

1. 从 GitHub Releases 下载 `RemoteCI-<版本>.fpk`。
2. 打开飞牛 fnOS 的"应用中心"，选择"手动安装"，选中该 fpk 文件。
3. 按安装向导填写：
   - Web 服务端口（默认 8080，桌面入口会跟随该端口）。
   - 管理员初始密码（至少 8 位；留空则首次启动随机生成并写入应用日志）。
   - 插件一次性配对码（留空则首次启动随机生成并写入应用日志）。
4. 安装完成后，从飞牛桌面打开 RemoteCI 入口（默认以新标签页打开 `http://NAS-IP:端口/`），用 `admin` 和初始密码登录。

::: tip 数据位置
SQLite 数据库保存在 `/var/apps/remoteci/var/data`（即安装时选择的存储卷），删除或升级应用不会丢失数据。
:::

## 更新

版本检查与升级由 fnOS 应用商店统一管理。WebUI 登录后进入“系统配置 → 系统更新”（管理员可见），该面板只显示“由fnOS应用商店管理”，不会在容器内下载或安装 fpk。

::: tip 更新入口
请直接在 fnOS 应用商店检查并安装更新；应用商店会按新 fpk 重建容器并拉取对应版本镜像。
:::

## 常见问题

### 桌面入口打不开

确认 `manifest.service_port`、compose 的端口映射和入口 `port` 三者一致；安装向导中修改过端口时，入口会自动使用向导值。

### 容器一直显示未运行

检查 `cmd/main` 中的 `CONTAINER_NAME` 是否与 `docker-compose.yaml` 的 `container_name` 一致（当前均为 `remoteci`），并确认 NAS 可以访问 `ghcr.io` 拉取镜像。

### 镜像拉取失败

确认镜像包在 GHCR 中可见性为 Public，且 NAS 网络可以访问 `ghcr.io`；国内网络可能需要配置镜像加速或改用可达的镜像仓库。

## 开发与打包

fpk 工程位于仓库 `fnos/` 目录，打包命令与字段说明见 `fnos/README.md`；fnOS 应用包格式的调研笔记保存在仓库 `research/fnos-fpk-packaging.md`。
