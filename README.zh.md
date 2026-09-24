# dsh-ssh — 远程 SSH 运维插件（DSH 版 ssh-skill）

[English](README.md) | 中文

基于 [badseal/ssh-skill](https://github.com/badseal/ssh-skill) 的能力清单，为 DeepSeek Harness（DSH）定制的远程 SSH 插件：Host 进程内的持久连接池 + Web GUI 主机管理面板 + Web 终端 + Agent 工具，全部通过官方 NPM SDK 实现，不修改 DSH 源码。

## 能力

| 能力 | 说明 |
| --- | --- |
| 主机管理 | 增删改查、搜索、连接测试；支持按环境 / 标签分组折叠与组内批量测试；配置存 `~/.dsh/dsh-ssh.json`；支持密钥 / 密码 / ssh-agent 认证（OpenSSH agent / Pageant）、passphrase 密钥、ProxyJump 跳板机（多级）与 OpenSSH `ProxyCommand` 传输层（堡垒机客户端场景） |
| 配置导入 | 一键解析标准 `~/.ssh/config`（Host/HostName/User/Port/IdentityFile/IdentityAgent/ProxyJump/ProxyCommand、`Include` 文件、无 HostName 的块）；被跳过的块逐条列出原因（通配符 pattern、别名已存在、Match 条件块、字段不合法） |
| 持久连接池 | 每台主机复用长连接（对应 ssh-skill 的守护进程），空闲 30 分钟自动断开，断线自动重连（最多 3 次） |
| 命令执行 | exec 带超时（默认 60s），stdout/stderr 分离，输出截断保护（2MB） |
| Web 终端 | xterm.js + WebSocket PTY 终端，自适应尺寸，实时输出 |
| 文件传输 | SFTP 上传（浏览器选文件，NDJSON 进度流）、下载（进度条 + 浏览器保存）；远程目录浏览 |
| 端口转发 | 本地端口转发隧道（仅监听 127.0.0.1），访问远程数据库 / 内网服务，支持列表 / 停止 |
| 集群执行 | 一条命令并发跑多台主机（按别名 / 环境 / 标签过滤，默认并发 8） |
| Agent 工具 | `ssh_list` / `ssh_exec` / `ssh_upload` / `ssh_download` / `ssh_tunnel` / `ssh_cluster`，GUI 与 Agent 共享同一份主机配置 |

面板在首次打开时加载内容。关闭后重新打开会保留选中的页签、表单草稿和终端会话。隧道列表仅在隧道页签、面板和浏览器页面都可见时每五秒刷新；隐藏时暂停自动查询，恢复可见时立即刷新，慢查询期间不叠加请求。端口转发本身继续在 Host 中运行。

## 安全模型

- 所有 `/api/dsh-ssh/*` 路由仅限 loopback 访问（含同源校验）——对远程服务器执行命令的接口不会暴露给局域网。
- 密码 / 密钥口令以明文保存在 `~/.dsh/dsh-ssh.json`，文件权限 0600、目录 0700（与 ssh-skill 把密码写进 ssh-config 注释同一信任模型）。
- ssh-agent 认证仅保存 agent socket 路径（或 `pageant` 特殊值），不读取也不保存任何私钥材料。
- 隧道只监听 `127.0.0.1`。
- 删除主机或修改其连接字段（host / port / user / auth / proxyJump / proxyCommand）会立即断开该别名的池化连接与隧道，后续操作按新配置重新建连，不会复用旧凭据的已认证连接。
- `proxyCommand` 是一条由 DSH 宿主进程以其自身权限执行的 shell 命令——与 `ssh(1)` 执行 `~/.ssh/config` 里同一行的信任模型一致。它只能来自用户自己的 0600 配置文件：Agent 无法创建或修改主机，`ssh_list` 只报告该主机是否配置了 ProxyCommand，不返回命令原文。
- Agent 使用工具前，主机需先在 GUI 中配置（或从 ~/.ssh/config 导入）。
- `ssh_upload` / `ssh_download` 以宿主进程权限直接读写本机任意路径（不经 bash 沙箱）——与 ssh-skill 的宿主本地路径语义一致，注意该权限面。
- Agent 传输工具只在本机与远程 SSH 主机之间移动文件；本机文件的读写一律使用本地文件工具（read / write / edit / bash），不要使用 `ssh_*` 工具。
- exec / cluster 的远程输出原样返回（不脱敏），命令如 `env` 可能把远端环境中的密钥带回对话记录。

## 安装、升级与卸载

本仓库是从 [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) 全家桶中拆出来的**独立单插件**，包名为 `@mikulo/dsh-ssh`，不发布到 npm，直接从 GitHub 安装。仓库里已提交构建好的 `lib/`，安装时不需要在本机编译。

```sh
# 安装（<profile> 换成你的 profile 名，例如 web）
dsh plugin --profile <profile> add github:mikulo/dsh-ssh

# 安装指定版本（tag 或 commit）
dsh plugin --profile <profile> add github:mikulo/dsh-ssh#v0.4.0

# 升级到 main 分支最新提交
dsh plugin --profile <profile> update @mikulo/dsh-ssh

# 卸载
dsh plugin --profile <profile> remove @mikulo/dsh-ssh
```

安装、升级或卸载后**重启 `dsh web`**：侧边栏出现「SSH」入口；开启 `announceToAgent` 后 Agent 提示词中会出现插件说明。

从上游 `@linxin666/dsh-ssh`（或全家桶 `@linxin666/dsh-web-all`）切换：先用 `dsh plugin --profile <profile> remove` 移除旧包，再按上面的命令安装。主机配置 `~/.dsh/dsh-ssh.json` 与插件条目 id `ssh` 不变，原有主机和设置会保留。**不要同时安装两者**，否则会重复注册同名的 `ssh_*` Agent 工具。

`ssh2` 的可选原生依赖 `cpu-features` 需要 C++ 编译器；没有编译器时安装日志会出现它的编译失败信息，可以忽略，`ssh2` 会自动使用纯 JS 实现。

## 配置

设置面板（插件配置）可开关 `announceToAgent`（是否向 Agent 宣告插件；默认关闭，保持系统提示词干净）与 `enabled`（总开关），并可设置 `terminalFontFamily`（Web 终端字体，留空则按 CSS 链解析：`--dsh-ssh-terminal-font` → 官方 `--ds-font-family-code` token → 内置 monospace 栈）。终端字体写死在 xterm 构造参数里，CSS 无法直接覆盖；要渲染 powerline / Nerd Font 图标，请在此填入对应 Nerd Font 栈（如 `"SauceCodePro Nerd Font", monospace`），修改对已打开的终端即时生效，无需重连。

## 数据

- 主机配置：`~/.dsh/dsh-ssh.json`（版本化 JSON，原子写入）
- 传输暂存：`os.tmpdir()/dsh-ssh-uploads/`（目录 0700，传输中的文件 0600）

## 开发

```sh
pnpm install
pnpm test            # 单测：store + 引擎（内嵌 ssh2 Server + 真实 sshd）
pnpm run typecheck
pnpm run build       # tsc 类型声明 + tsdown 双半区产物（lib/index.js、lib/client.js）
```

修改 `src/` 后必须重新构建，并把 `lib/` 与源码**一起提交**——用户通过 git 安装时直接使用仓库里的 `lib/`。构建预设在 `build/tsdown.client.ts`（从原 monorepo 的 `shared/` 移入）。

## 已知限制

- 上传的远程目标路径必须是绝对路径（相对路径会被拒绝）。
- 下载暂不支持整个目录（逐文件下载）；上传支持目录递归（walk 本地目录逐文件传）。
- exec 断线自动重连（最多 3 次）可能重复执行非幂等命令——长命令注意副作用。
- 跳板机 ProxyJump 的每一跳可以是本插件已配置的主机别名，也可以是 OpenSSH 的 `[user@]host[:port]` 地址；地址形式的跳板没有自己的凭据，复用目标主机的认证（跳板需要独立凭据时请单独配置主机）。
- 同一台主机不能同时配置 `proxyCommand` 与 `proxyJump`（OpenSSH 按「配置中先出现者生效」解析，而存储条目没有先后顺序，因此直接报错），且链式跳板中只有第一跳可以声明 ProxyCommand。
- ProxyCommand 由用户 shell 执行，因此继承 DSH 进程的 `PATH` 与环境变量。Windows 上只杀 shell、不带进程组，它拉起的客户端进程可能比传输层存活更久。
- ssh_config 导入会展开 `Include`（glob、`~`、多路径、相对配置目录），但不支持环境变量与 `%` token；`Host a b` 这类多 pattern 行仍只导入第一个 pattern。
- 断点续传（resume）暂未实现。
- Agent 工具的传输为宿主机器本地路径（与 ssh-skill 相同的语义）。

## 数据遥测

本 fork 已移除上游的匿名安装心跳（原先每天向 dsh-market.com 上报一次），插件不会主动向任何第三方发送数据。
