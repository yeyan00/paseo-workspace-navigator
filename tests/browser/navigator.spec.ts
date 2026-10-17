import { expect, test } from "@playwright/test";

test("host tree, configurable sorting, search, persistent collapse and cross-host navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const projects = () => page.locator('[data-testid^="project-local-"]');
  await expect(projects()).toHaveCount(4);
  await expect(projects().first()).toHaveAttribute("data-testid", "project-local-navigator");
  await page.getByRole("button", { name: "排序", exact: true }).click();
  await page.getByRole("radio", { name: "项目名称", exact: true }).click();
  await page.getByRole("radio", { name: "升序", exact: true }).click();
  await page.getByRole("switch", { name: "执行中优先" }).click();
  await page.getByRole("button", { name: "Close sort" }).click();
  await expect(projects().first()).toHaveAttribute("data-testid", "project-local-website");
  await page.reload();
  await expect(projects().first()).toHaveAttribute("data-testid", "project-local-website");
  await page.getByTestId("project-local-navigator").click();
  await expect(page.getByTestId("workspace-local-navigation")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("project-local-navigator")).toBeVisible();
  await expect(page.getByTestId("workspace-local-navigation")).toHaveCount(0);
  const search = page.getByRole("textbox");
  await search.fill("Host 分组");
  await expect(page.getByTestId("workspace-local-navigation")).toBeVisible();
  await expect(page.getByTestId("project-local-paseo")).toHaveCount(0);
  await page.getByRole("button", { name: "清空搜索" }).click();
  await expect(page.getByTestId("workspace-local-navigation")).toHaveCount(0);
  await search.fill("Windows");
  await page.getByTestId("workspace-remote-build").click();
  await expect(page.getByTestId("opened-target")).toHaveText("remote/build");
  expect(errors).toEqual([]);
});

test("live execution completion, offline host isolation and search empty state", async ({
  page,
}) => {
  await page.goto("/");
  const workspace = page.getByTestId("workspace-local-navigation");
  await expect(workspace).toContainText("执行中");
  await page.getByRole("button", { name: "Finish demo execution" }).click();
  await expect(workspace).toContainText("已结束");
  await page.getByRole("button", { name: "Toggle remote connection" }).click();
  await expect(page.getByTestId("workspace-remote-build")).toBeDisabled();
  await expect(page.getByTestId("workspace-local-login")).toBeEnabled();
  await page.getByRole("button", { name: "Toggle remote connection" }).click();
  await expect(page.getByTestId("workspace-remote-build")).toBeEnabled();
  await page.getByRole("textbox").fill("no-such-project");
  await expect(page.getByText("没有匹配的项目或工作区", { exact: true })).toBeVisible();
  await expect(page.getByTestId("workspace-remote-build")).toHaveCount(0);
});

test("preview screenshots and narrow layout remain usable", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByTestId("project-local-navigator")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
  await page.screenshot({
    path: `assets/navigator-${testInfo.project.name === "compact" ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
});
