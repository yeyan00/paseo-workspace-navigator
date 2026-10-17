# Workspace Navigator

[English](#english) · [中文](#中文)

## 中文

Paseo 的独立工作区导航插件。按 **Host → Project → Workspace** 展示，减少多主机、多项目时反复滚动寻找工作区的操作。

### 功能

- 可折叠的主机、项目树，显示连接状态。
- 默认**执行中优先，其余按最近执行结束时间倒序**。
- 排序图标打开设置，支持执行结束时间或名称、升降序及“执行中优先”独立开关。项目和工作区使用相同排序规则；主机顺序跟随 Paseo 配置。
- 搜索主机、项目、路径、工作区和分支。搜索时临时展开匹配项，清空后恢复折叠状态。
- 点击工作区进入所属主机的 Paseo 原生工作界面。
- 排序、折叠状态和界面语言保存在插件所在主机，由该主机的客户端共享。
- 中文／英文；手机紧凑布局；离线主机保留本次页面已经加载的数据，禁用打开操作。

### 安装

要求 **Paseo 客户端和 daemon 0.11.4 或更新版本**。先在目标主机的 Settings → Plugins 中开启插件，再安装 Git 源：

```sh
paseo plugin install git:yeyan00/paseo-workspace-navigator
```

本地开发目录安装：

```powershell
paseo plugin install "C:\00_work\greenvalley\code\llm\paseo-plugins\paseo-workspace-navigator"
```

打开侧栏 **Workspace Navigator**，或在 Command Center 搜索同名命令。安装在一台主机后，页面可以读取客户端已连接的其他主机，目标主机无需重复安装。承载插件的主机必须可用。

> 插件在 daemon 和客户端中作为受信任代码运行。本插件只查询目录和状态、打开工作区，并保存自身的显示偏好；不读取聊天正文，不发送提示词，不执行 shell，也不归档或删除工作区。

### 排序时间的含义

项目的结束时间取所有可见工作区的最新值。工作区使用 Paseo 报告的结束／失败状态进入时间，以及 Agent 的完成／错误 attention 时间。等待输入不算完成，执行中状态优先于结束时间。

公开 API 没有完整的执行结束历史，已有状态时间是**最佳可用近似值**，不保证等于最后一条消息的精确时间。无时间的项目稳定排在后面；相同时间按名称排序。不使用项目创建、首次发现、点击打开、Agent `updatedAt` 或流式输出时间。

### 手机支持

生产代码使用 React Native、宿主的 FlatList、TextInput 和 Modal，不依赖 DOM、localStorage 或网页侧栏结构。手机使用紧凑布局和宿主弹层。已验证手机尺寸下的 Web 交互；**iOS／Android 原生客户端尚未真机验证**。

插件新增独立导航页，不替换 Paseo 内置 Workspaces 侧栏。初次加载离线主机时没有缓存；关闭导航页后不会继续订阅数据。不同主机安装的插件各自保存偏好。

### 开发与验证

Node.js 22.18+。

```sh
npm ci
npm run check
npm run test:browser
npm run check:package
```

浏览器测试默认使用已安装的 Microsoft Edge；其他环境修改 `playwright.config.ts` 的浏览器 channel。录像依赖 `npx playwright install ffmpeg`。

```sh
npm run preview
```

本地预览地址为 `http://127.0.0.1:5178`。预览使用明确标注的示例数据和模拟 SDK，不连接真实 daemon。它运行真实的导航组件、树模型和目录订阅逻辑，但不能替代 Paseo 内的集成验证。

修改后运行 `paseo plugin reload workspace-navigator`，查看日志用 `paseo plugin logs workspace-navigator`。

详见 [验证记录](docs/verification.md) 和 [市场发布](docs/publishing.md)。

## English

A focused Paseo navigator organized as **Host → Project → Workspace**. Expand hosts and projects, search names, paths and branches, and open a workspace on its owning host.

Default order is **running first, then latest execution end time**. The sort menu offers execution end time or name, ascending or descending, and an independent running-first toggle. Hosts keep Paseo's configured order. Missing execution timestamps always sort last. Sorting uses reported workspace status-entry and agent completion/error attention timestamps, not creation, opening or streaming timestamps. The public API does not expose a complete execution-end history, so these timestamps are best-effort.

Requires Paseo client and daemon **0.11.4+**. Enable plugins on the installation host, then install using the Git command above. Open **Workspace Navigator** from the sidebar or Command Center. Other connected hosts do not need the plugin installed. The installation host supplies shared sort, collapse and language preferences and must remain available.

The plugin adds a separate screen rather than replacing Paseo's built-in sidebar. Production uses React Native and public SDK APIs, with compact layouts for phones. Desktop and mobile-sized browser interactions are tested; native iOS and Android are not yet device-verified. Screenshots below show the real UI with labelled sample data, not a live daemon.

![Desktop preview with sample data](assets/navigator-desktop.png)

![Compact preview with sample data](assets/navigator-mobile.png)
