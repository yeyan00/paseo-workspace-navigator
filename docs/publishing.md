# 发布到 Paseo 插件市场

## 发布前

1. 在真实 Paseo 0.11.4+ daemon 和客户端安装、验证至少两个 Host 的导航及排序。
2. 手机原生端实测后，在 `docs/verification.md` 写明客户端版本和平台；未测平台保持标注。
3. 运行 `npm run check`、`npm run test:browser`、`npm run check:package`。
4. 更新 README、OVERVIEW 和截图。当前截图来自标注 SAMPLE DATA 的本地预览，不应作为真实 daemon 测试证据。
5. 提交并推送代码，创建明确的版本 tag，例如 `v0.1.0`。manifest 的 Paseo 要求与实际使用的 SDK 对齐。

## Git 发布与收录

在 https://github.com/getpaseo/plugins/issues/new?template=submit-plugin.yml 提交：

- 标题：Workspace Navigator
- Source：`https://github.com/yeyan00/paseo-workspace-navigator/tree/v0.1.0`
- Categories：Sidebar、Workspaces

机器人创建审核 PR，审核者检查指定提交并锁定 artifact。审核通过并合并后显示在 https://paseo.sh/plugins 。最终安装 ID 以注册表记录为准，预期类似 `yeyan00/workspace-navigator`。

市场锁定审核版本，不跟随 main 自动更新。**Git 更新是手动的**：提交新版本申请，或向注册表记录提出新的 commit。用户直接安装 Git 源无需等待市场收录。

## 可选 npm 发布

包名需先确认 npm 账号有权限。准备发布后运行：

```sh
npm run check:package
npm publish --access public
```

用明确版本安装验证，再提交 npm 包链接。市场工作流可为 npm 新版本自动创建更新 PR，但仍需要审核。

## 页面内容

`OVERVIEW.md` 面向决定是否安装的用户：用途、设置、数据访问、版本及限制，不放安装命令。`README.md` 面向仓库读者。图片随版本保存，manifest 的 `media` 使用相对路径。图标为可选项。

参考：[注册表说明](https://github.com/getpaseo/plugins)、[审核政策](https://github.com/getpaseo/plugins/blob/main/REVIEW.md)、[官方发布指南](https://paseo.sh/docs/plugins/publishing)。
