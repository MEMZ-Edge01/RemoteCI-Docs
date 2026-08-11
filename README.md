# RemoteCI 文档

RemoteCI 的项目介绍、使用指南和服务端部署文档。

文档站基于 VuePress 2 与 VuePress Theme Hope，信息架构参考 ClassIsland 文档站，但使用 RemoteCI 自有内容与视觉资产。

## 本地预览

需要 Node.js 20 和 pnpm 9。

~~~powershell
corepack prepare pnpm@9.9.0 --activate
pnpm install
pnpm docs:dev
~~~

## 构建

~~~powershell
pnpm docs:build
~~~

## 文档同步

RemoteCI 每次增加、删除或改变用户可见功能时，都必须同步更新本仓库。完整规则见 <code>src/development/docs-maintenance.md</code>。

## 发布

推送到 <code>main</code> 后，GitHub Actions 会构建并部署站点。首次发布前，需要在仓库“Settings → Pages”中把 Source 设为“GitHub Actions”。

## 相关仓库

- RemoteCI：https://github.com/MEMZ-Edge01/RemoteCI
- RemoteCI-Docs：https://github.com/MEMZ-Edge01/RemoteCI-Docs
- 参考站：https://docs.classisland.tech/
