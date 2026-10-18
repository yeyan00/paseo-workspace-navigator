import { expect, test } from "@playwright/test";

test("create in an empty project, open, rename and archive a workspace on its owning host", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("project-local-empty").click();
  await page.getByRole("textbox").fill("demo-starter");
  await page.getByRole("button", { name: "新建 Workspace: demo-starter", exact: true }).click();
  await page.getByRole("textbox", { name: "Workspace 名称", exact: true }).fill("Sample task");
  await page.getByRole("button", { name: "创建并打开", exact: true }).click();
  await expect(page.getByTestId("opened-target")).toHaveText("local/created-1");
  const created = page.getByTestId("workspace-local-created-1");
  await expect(created).toContainText("Sample task");
  await expect(page.getByRole("textbox")).toHaveValue("");
  await page.getByRole("button", { name: "Workspace 操作: Sample task", exact: true }).click();
  await page.getByRole("button", { name: "重命名", exact: true }).click();
  await page.getByRole("textbox", { name: "Workspace 名称", exact: true }).fill("Renamed task");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(created).toContainText("Renamed task");
  await page.getByRole("button", { name: "Workspace 操作: Renamed task", exact: true }).click();
  await page.getByRole("button", { name: "归档 Workspace", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(created).toBeVisible();
  await page.getByRole("button", { name: "Workspace 操作: Renamed task", exact: true }).click();
  await page.getByRole("button", { name: "归档 Workspace", exact: true }).click();
  await page.getByRole("button", { name: "确认归档", exact: true }).click();
  await expect(created).toHaveCount(0);
  await expect(page.getByTestId("project-local-empty")).toBeVisible();

  await page.getByRole("button", { name: "项目操作: demo-api", exact: true }).click();
  await page.getByRole("button", { name: "新建 Workspace", exact: true }).click();
  await page.getByRole("textbox", { name: "Workspace 名称", exact: true }).fill("Isolated task");
  await page.getByRole("radio", { name: "创建独立 worktree", exact: true }).click();
  await page.getByRole("textbox", { name: "基础分支 / ref（可选）", exact: true }).fill("main");
  await page
    .getByRole("textbox", { name: "新分支名称（可选）", exact: true })
    .fill("feature/sample");
  await page.getByRole("button", { name: "创建并打开", exact: true }).click();
  await expect(page.getByTestId("opened-target")).toHaveText("remote/created-2");
  await expect(page.getByTestId("workspace-remote-created-2")).toContainText("Isolated task");
  await page.getByRole("button", { name: "Workspace 操作: Isolated task", exact: true }).click();
  await page.getByRole("button", { name: "归档 Workspace", exact: true }).click();
  await expect(page.getByText(/若它由 Paseo 管理/)).toBeVisible();
});

test("failed mutations preserve the workspace and remain retryable; offline actions are disabled", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建 Workspace: demo-starter", exact: true }).click();
  await page.getByRole("textbox", { name: "Workspace 名称", exact: true }).fill("fail-create");
  await page.getByRole("button", { name: "创建并打开", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Sample creation failure");
  await page.getByRole("textbox", { name: "Workspace 名称", exact: true }).fill("Retry task");
  await page.getByRole("button", { name: "创建并打开", exact: true }).click();
  await expect(page.getByTestId("opened-target")).toHaveText("local/created-2");
  await page.getByRole("button", { name: "Workspace 操作: Retry task", exact: true }).click();
  await page.getByRole("button", { name: "重命名", exact: true }).click();
  await page.getByRole("textbox", { name: "Workspace 名称", exact: true }).fill("fail-rename");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Sample rename failure");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByTestId("workspace-local-created-2")).toContainText("Retry task");
  await page.getByRole("button", { name: "Workspace 操作: Retry task", exact: true }).click();
  await page.getByRole("button", { name: "重命名", exact: true }).click();
  await page.getByRole("textbox", { name: "Workspace 名称", exact: true }).fill("fail-archive");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "Workspace 操作: fail-archive", exact: true }).click();
  await page.getByRole("button", { name: "归档 Workspace", exact: true }).click();
  await page.getByRole("button", { name: "确认归档", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Sample archive failure");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByTestId("workspace-local-created-2")).toBeVisible();
  await page.getByRole("button", { name: "Toggle remote connection" }).click();
  await expect(
    page.getByRole("button", { name: "新建 Workspace: demo-api", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Workspace 操作: Check demo build", exact: true }).click();
  await expect(page.getByRole("button", { name: "重命名", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "归档 Workspace", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "新建 Workspace: demo-starter", exact: true }).click();
  await page.getByRole("textbox", { name: "Workspace 名称", exact: true }).fill("Cache isolation");
  await page.getByRole("button", { name: "创建并打开", exact: true }).click();
  await expect(page.getByTestId("workspace-local-created-3")).toContainText("Cache isolation");
  await expect(page.getByTestId("workspace-remote-build")).toBeVisible();
});

test("copy uses the client clipboard and a lost create response retries without duplicating", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Workspace 操作: main", exact: true }).click();
  await page.getByRole("button", { name: "复制分支名", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("main");
  await page.getByRole("button", { name: "项目操作: demo-starter", exact: true }).click();
  await page.getByRole("button", { name: "复制路径", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("/dev/empty");
  await page.getByRole("button", { name: "新建 Workspace: demo-starter", exact: true }).click();
  await page.getByRole("textbox", { name: "Workspace 名称", exact: true }).fill("retry-response");
  await page.getByRole("button", { name: "创建并打开", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Sample response lost");
  await expect(page.getByRole("textbox", { name: "Workspace 名称", exact: true })).toHaveValue(
    "retry-response",
  );
  await page.getByRole("button", { name: "创建并打开", exact: true }).click();
  await expect(page.getByTestId("opened-target")).toHaveText("local/created-1");
  await expect(
    page.getByRole("button", { name: "Workspace 操作: retry-response", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByTestId("workspace-local-created-2")).toHaveCount(0);
});
