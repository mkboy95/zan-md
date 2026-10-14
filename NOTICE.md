# 署名与开源协议声明（NOTICE）

本项目 **超赞 Markdown 编辑器（Zan MD）** 是基于 [doocs/md](https://github.com/doocs/md) 的衍生作品。

## 上游协议

doocs/md 采用 **WTFPL（DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE, Version 2）**：

> Everyone is permitted to copy and distribute verbatim or modified copies of this license document, and changing it is allowed as long as the name is changed. 0. You just DO WHAT THE FUCK YOU WANT TO.

基于该协议，你可以将本项目（含本仓库中的全部修改）当作**自己的开源项目**自由使用、修改、再发布、商用，无需额外授权，也无需保留本协议文本。

## 署名（建议保留，非强制）

- 原始作者：Doocs &lt;admin@doocs.org&gt;
- 衍生修改：mkboy95（「维客绿」主题、EdgeOne Pages 部署、GitHub 云同步、顶部主题切换等）

## 本仓库新增 / 修改的主要内容

- 内置主题 `packages/shared/src/configs/theme-css/weike.css`（绿丝带一级标题等）
- `edgeone.json` 与 `edge-functions/`（EdgeOne Pages 部署 + GitHub OAuth 中转，无数据库）
- `apps/web/src/services/sync/github/*`（基于 GitHub 私有仓库的跨设备云同步后端）
- `apps/web/src/components/editor/editor-header/ThemeSwitcher.vue`（顶部主题切换按钮）

完整协议文本见仓库根目录 [LICENSE](./LICENSE)。
