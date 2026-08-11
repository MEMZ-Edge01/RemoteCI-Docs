import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: process.env.DOCS_BASE ?? "/RemoteCI-Docs/",
  lang: "zh-CN",
  title: "RemoteCI 文档",
  description: "RemoteCI 项目介绍、使用指南与服务端部署文档",
  head: [
    ["meta", { name: "theme-color", content: "#6750a4" }],
    ["link", { rel: "icon", href: "logo.svg" }],
  ],
  theme,
});

