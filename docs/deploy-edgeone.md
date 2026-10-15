# 部署到腾讯云 EdgeOne Pages（免费）+ 跨设备云同步

这套部署方式的目标：

- **前端**托管在 EdgeOne Pages（免费版不限流量/请求数）；
- **登录**走 GitHub OAuth，只有一个约 70 行的边缘函数做中转；
- **文章数据**存在你自己的 GitHub **私有仓库**里，不依赖任何数据库；
- 换任何设备（含手机浏览器）登录后，都能看到自己编辑过的全部文章。

```
浏览器 ──静态资源──▶ EdgeOne Pages （apps/web/dist）
   │
   ├─点击登录──▶ EdgeOne Edge Function  /api/auth/github
   │                    │ 换 access_token（client_secret 只在函数里）
   │                    ▼
   │              GitHub OAuth ──▶ 回跳 #account_token=<token>
   │
   └─同步读写──▶ api.github.com（直连）
                     ▼
             你的私有仓库 <login>/md-sync
```

> **为什么不把后端也放在 EdgeOne 上？**
> Edge Functions 的请求体上限是 **1MB**，而一篇文章带上历史版本后很容易超过；且 KV 只能在 Edge
> Functions 中使用。让浏览器直连 GitHub API 既绕开了这两个限制，也省掉了数据库和 1GB KV 配额。
> 唯一必须放在服务端的只有 OAuth 的 `client_secret` 交换。

---

## 部署前检查清单

仓库里已经为你准备好的东西（无需改动）：

- [x] `edgeone.json` — 构建命令、产物目录 `apps/web/dist`、Node 22.21.1、SPA 回退
- [x] `edge-functions/api/auth/github.js` 与 `.../callback.js` — OAuth 中转函数
- [x] `apps/web/src/services/sync/github/*` — 浏览器直连 GitHub 的同步客户端（含 11 个测试）
- [x] 默认构建产物 base 已改为根路径 `/`（`build:h5-netlify`）

还需要你准备的（三件事，约 10 分钟）：

- [ ] **一个已备案的域名**（国内直连必需；没有也能先部署，只是国内访问受限）
- [ ] **一个 GitHub OAuth App**（拿 Client ID / Client secret）— 见第二节
- [ ] **EdgeOne 控制台里配好环境变量**（前端 6 个 `VITE_` + 函数 5 个）— 见第四节

> 只想要编辑器、暂不接登录同步？那这三件都不用准备，直接导入仓库即可部署使用。

---

## 一、先确认域名（这一步决定国内能不能直连）

EdgeOne 免费版对**项目域名 / 部署域名**有两条限制：

| 加速区域                   | 自定义域名是否要备案 | 中国大陆访问 |
| -------------------------- | -------------------- | ------------ |
| 中国大陆可用区             | 需要                 | 可直连       |
| 全球可用区（含中国大陆）   | 需要                 | 可直连       |
| 全球可用区（不含中国大陆） | 不需要               | **返回 401** |

补充：如果不绑自定义域名，通过平台分配的预览链接访问，**该链接只有 3 小时有效期**，过期返回 401。

**结论**：想长期、稳定地在大陆直连，必须有**已备案的自定义域名**。若暂时没有备案域名，仍可先按
「全球可用区（不含中国大陆）」部署跑通全部功能，等功能验证完再补备案、切换区域。

---

## 二、创建 GitHub OAuth App

打开 <https://github.com/settings/developers> → **New OAuth App**：

| 字段                       | 填写                                              |
| -------------------------- | ------------------------------------------------- |
| Application name           | 随意，例如 `md-sync`                              |
| Homepage URL               | 你的站点地址，例如 `https://md.example.com`       |
| Authorization callback URL | `https://md.example.com/api/auth/github/callback` |

> ⚠️ callback 地址必须**完全一致**，末尾不要多斜杠，且要和最终域名（自定义域名）一致。
> 记下 **Client ID**，并生成一个 **Client secret**。

---

## 三、在 EdgeOne Pages 创建项目

1. 进入 EdgeOne Pages 控制台：<https://pages.edgeone.ai/>（或腾讯云控制台 → EdgeOne → Pages）。
2. 点 **创建项目** → 选 **连接 Git 仓库 / 从 Git 导入**（不要选「从模板开始」）。
3. 选择 **GitHub**，按页面提示完成授权（点 `Authorize EO Pages` / `Install`），允许访问你的仓库。
4. 在仓库列表里选中 `mkboy95/zan-md`。
5. 构建配置由仓库根目录的 [`edgeone.json`](../edgeone.json) 在**构建时**提供：

```json
{
  "name": "zan-md",
  "installCommand": "npm_config_registry=https://registry.npmmirror.com npx --yes pnpm@12.6.0 install --frozen-lockfile",
  "buildCommand": "npx --yes pnpm@12.6.0 --filter @md/web build:h5-netlify",
  "outputDirectory": "apps/web/dist",
  "nodeVersion": "22.21.1",
  "rewrites": [{ "source": "/*", "destination": "/index.html" }]
}
```

> ⚠️ **控制台表单不会自动识别本项目，必须手填。** 这是 pnpm monorepo：根目录没有 `build` 脚本、
> 没有任何框架配置文件（vite 配置在 `apps/web/` 里），EdgeOne 的框架探测器只认标准单应用项目，
> 所以导入后「构建设置」是空的（框架预设 Other、命令框只有占位符）。
> 请把上表三个值**手动填进控制台**：安装命令 / 构建命令 / 输出目录（根目录保持 `./`）。
> 表单填了就以表单为准；不填则构建时读 `edgeone.json`——两条路内容一致，填表单是为了确定性。

两个容易踩的点，已经在这里处理掉了：

- **必须用 `build:h5-netlify` 而不是默认构建**。默认构建产物的资源路径带 `/md/` 前缀
  （`vite.config.ts` 里 `base` 默认值），根路径托管会全部 404；`SERVER_ENV=NETLIFY` 会把 base 改成 `/`。
- **`rewrites` 那条是 SPA 回退**。EdgeOne 会把它识别为 SPA fallback，仅在未命中静态资源或函数时
  才返回 `index.html`，不会抢占 `/api/*`。

> ⚠️ **Node 版本只能用 EdgeOne 预装列表里的版本，且必须 ≥ 22.12。** 官方预装列表：
> `14.21.3 / 16.20.2 / 18.20.4 / 20.18.0 / 22.11.0 / 22.17.1 / 22.21.1 / 24.5.0 / 24.11.0`。
> 本项目固定选 **22.21.1**——预装列表里唯一满足 `vite@8` engines（`^20.19.0 || >=22.12.0`）的 22.x。
> 填列表外的版本（如 22.22.2）会直接失败：`Switching error: Failed to switch to Node.js 22.22.2`。
>
> **两个地方都要是 22.21.1**，它们是两套独立机制，改一个不管另一个：
> 1. `edgeone.json` 的 `nodeVersion`（会覆盖控制台设置）
> 2. 仓库根目录的 `.nvmrc`——**上游 doocs/md 自带这个文件，内容同样会触发版本切换**，很容易漏改。
>    控制台里也可去 Project settings → Node.js Version 同步选 22.21.1。
>
> 根 `package.json` 的 `engines.node` 相应放宽到 `>=22.12.0`（预装环境满足不了 22.22.2；
> pnpm 默认只警告不阻断，但日志里会有一条 Unsupported engine 提示，属正常）。
>
> 另外**不要用 `corepack enable`**：构建容器没有写 `/usr/local/bin` 的权限，会直接报
> `EACCES: permission denied, symlink .../yarnpkg.js -> '/usr/local/bin/yarnpkg'`。
> 本项目的命令用 `npx --yes pnpm@12.6.0` 直接调包管理器，不需要 `enable`，也不依赖全局安装。

3. 加速区域：有备案域名选「中国大陆可用区」或「全球可用区（含中国大陆）」。

---

## 四、配置环境变量

在项目设置 → **环境变量**中添加下面这些。构建期变量（`VITE_` 前缀）需要参与打包，
运行时变量供边缘函数读取：

### 构建期（打前端包时使用）

| 变量                      | 取值                 | 说明                               |
| ------------------------- | -------------------- | ---------------------------------- |
| `VITE_SYNC_BACKEND`       | `github`             | 切换到 GitHub 同步后端             |
| `VITE_GITHUB_REPO`        | `你的用户名/md-sync` | 留空则自动用 `<登录名>/md-sync`    |
| `VITE_ACCOUNT_UI_ENABLED` | `true`               | 显示登录入口                       |
| `VITE_SYNC_UI_ENABLED`    | `true`               | 显示云同步入口                     |
| `VITE_GITHUB_BRANCH`      | `main`               | 可选                               |
| `VITE_GITHUB_DATA_DIR`    | `.md-sync`           | 可选，换目录可在同一仓库放多套数据 |

> 仓库里的 `apps/web/.env.production` 默认指向 doocs 官方后端（`VITE_SYNC_API_URL`）。
> 平台上的环境变量优先级高于 `.env` 文件，所以照上表配置即可覆盖；
> 如果你更喜欢直接改文件，也可以在 `.env.production` 里加上这几项。

### 运行时（边缘函数读取）

| 变量                   | 取值                                                |
| ---------------------- | --------------------------------------------------- |
| `GITHUB_CLIENT_ID`     | 第二步拿到的 Client ID                              |
| `GITHUB_CLIENT_SECRET` | 第二步拿到的 Client secret                          |
| `OAUTH_STATE_SECRET`   | 自己随便生成一段长随机串（用于给 state 签名防伪造） |
| `APP_ORIGIN`           | `https://md.example.com`（站点地址，不带末尾斜杠）  |
| `GITHUB_SCOPE`         | 可选，默认 `repo`（要读写私有仓库必须有它）         |

> 说明：本项目的边缘函数位于 `edge-functions/`，EdgeOne 会按目录结构自动生成路由：
> `edge-functions/api/auth/github.js` → `/api/auth/github`，
> `edge-functions/api/auth/github/callback.js` → `/api/auth/github/callback`。

---

## 五、绑定自定义域名

项目设置 → **域名管理** → 添加自定义域名 → 按提示在 DNS 处添加 CNAME 记录。证书由平台自动签发。

绑定后请回头检查 OAuth App 的 callback 与 `APP_ORIGIN` 是否都是这个最终域名。

---

## 六、验证

1. 打开站点，点头像/登录，跳转 GitHub 授权后应回到站点。
2. 地址栏短暂出现 `#account_token=...` 后自动清理（token 存在浏览器本地，不会发给任何服务器）。
3. 写一篇文章，等待自动同步（GitHub 后端默认开启自动同步，编辑后约 3 秒触发一次），
   然后去 `https://github.com/<你>/md-sync/commits/main` 看是否出现 `md sync: ...` 提交。
4. 换一台设备（或手机浏览器）登录，应能直接看到刚才的文章。

---

## 七、数据在哪里 / 怎么备份

```
<你的仓库>/
└── .md-sync/
    ├── index.json                 游标 + 每个条目的文件路径与更新时间
    ├── documents/<name>.json      一篇文章一个文件
    └── settings/<hash>.json       一条偏好设置一个文件
```

- 每次同步只产生**一个提交**，`git log` 就是天然的版本历史，随时可以回滚到任意时间点。
- 备份 = 这个仓库本身；迁移 = 把这个仓库指向新的部署（改 `VITE_GITHUB_REPO` 即可）。
- 想清空云端数据：删掉 `.md-sync` 目录后提交，再到站点里重新同步。

---

## 八、常见问题

**登录后一片空白 / 侧边栏没有同步按钮**
检查 `VITE_SYNC_BACKEND=github` 是否在**构建期**生效（它是打包时读取的，改了要重新构建）。

**回跳时报 `oauth_error=invalid_state`**
`OAUTH_STATE_SECRET` 变了，或授权超过 10 分钟才完成。重新登录一次即可。

**回跳时报 `oauth_error=token_exchange_failed`**
callback URL 与 OAuth App 中登记的不一致（常见于先用了预览域名、后绑自定义域名）。改成最终域名。

**同步报 404 / 「数据仓库 xxx 不存在」**
`VITE_GITHUB_REPO` 写错，或该仓库不是你自己的。留空可让程序自动创建 `<登录名>/md-sync`。

**同步报 403**
GitHub 拒绝了写入。确认授权时给了 `repo` scope，且仓库没有被归档/保护分支。

**换设备登录后看不到历史文章**
首次登录会自动拉取一次；若仍为空，点一下同步按钮。另外确认两台设备连的是**同一个 GitHub 账号**。
