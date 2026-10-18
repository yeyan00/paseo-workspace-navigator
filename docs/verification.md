# Verification

## Environment

- Windows development machine, Node.js 24.14.0.
- Published Paseo SDK packages: `@getpaseo/plugin`, `@getpaseo/client`, `@getpaseo/protocol` 0.11.4.
- Browser preview uses the real navigation UI and observers with sample data and simulated host/settings adapters.

## Automated checks

Latest local result for the 0.2.0 working tree: TypeScript and formatting passed;
**12 affected model/action unit tests** and **14 browser checks** passed. The
unchanged observer and settings suites previously passed in 0.1.0. Both client and server contribution bundles compiled
and their registration entries executed successfully in the package smoke check.
The package contents check passed for `paseo-workspace-navigator-0.2.0.tgz`.

- TypeScript checks production code without DOM or Node globals. A separate tools configuration checks tests and preview code.
- Model tests cover running-first, execution-end asc/desc, numeric name sorting, optional running priority, empty projects, host-qualified identity, search-independent ranking, and execution state changes.
- Observer tests cover pagination, events received during hydration, reconnect replacement, partial failure and releasing subscriptions including late responses after unmount.
- Settings tests cover defaults, validation and idempotent/rebased collapse operations.
- Mutation unit tests cover exact project placement, directory/worktree creation options, non-Git restrictions and archive errors returned in resolved SDK payloads.
- Playwright runs on desktop (1280 × 1000) and a touch-enabled phone-sized Chromium context. It covers search, sorting, reload persistence, collapse restoration, cross-host targets, live completion, offline isolation and horizontal overflow. Management checks cover new workspaces in empty projects and remote worktrees, rename, confirmed/cancelled archival, retained input on failure, client clipboard copying and idempotent retries after a lost create response. A mutation on an online host preserves another host's offline cache.
- Host ownership checks use deliberately out-of-order host responses and duplicate project IDs. They verify row ownership after host reordering, independent host collapse and reconnect, plus the target host shown in workspace actions. The reported native phone grouping issue has not been reproduced in this preview; native retesting is still required.
- Package check compiles both runtime bundles with host modules external, executes their contribution entries against a simulated host, and checks npm package contents. This is not the full Paseo compiler or daemon runtime.
- Install regression check downloads the official Paseo compiler at commit `e08389065c65630993e80c27f4c249a0b0423eb7`, reproduces the old direct-type-import failure, and compiles both fixed entries in an isolated checkout without `node_modules`. Client/protocol types are now derived from the host-provided plugin SDK. This validates compilation, not a live daemon installation.
- Native syntax check compiles that exact official client bundle to bytecode with React Native 0.81.5's Hermes compiler. It reproduced the reported `885:20: Invalid expression encountered` at the bundled observer class. The observer is now a closure-based function and the bundle passes Hermes compilation. This is engine compilation coverage, not native UI/device execution.

Commands:

```sh
npm run check
npm run test:browser
npm run check:package
npm run check:install
```

## Platform matrix

| Platform                                 | Status                                            |
| ---------------------------------------- | ------------------------------------------------- |
| Windows Edge, isolated Web preview       | Automated browser verification                    |
| Phone-sized touch browser preview        | Automated browser verification, not native mobile |
| Actual Paseo desktop with live host      | Author confirmed installation and opening         |
| Actual Paseo phone client with live host | Author reported normal operation after Hermes fix |
| iOS native                               | Not yet verified                                  |
| Android native                           | Not yet verified                                  |
| macOS/Linux packaged desktop             | Not yet verified                                  |

### Author-reported live checks

The author confirmed that the plugin installed and its navigation screen opened on
desktop. They then reported a native mobile loading error, `885:20: Invalid expression
encountered`, on the earlier `af3a31a` revision. The same error and location were
reproduced with Hermes. After the fix released in `v0.1.0` (`87f82d9`), the author
confirmed the phone plugin now operates normally.

These live reports apply to the navigation-only 0.1.0 release. The 0.2.0 management
actions have automated preview and compilation coverage and still need live-client verification.

These are user-reported live results, not agent-driven device tests. Exact Paseo
client/daemon versions and the phone OS/version were not recorded. The individual
native iOS/Android rows therefore remain unverified as a platform matrix. Multi-host
navigation, settings conflict handling and long-directory cases have automated
coverage or a procedure below, but no claim of complete live execution is made.

## Live verification procedure

1. Enable plugins on a test daemon and install this directory.
2. Connect the app to two hosts. Include duplicate project IDs/names, an empty project and more than 200 workspaces if available.
3. Start and finish runs. Check running-first and latest-ended ordering, waiting-for-input handling and name direction.
4. Search for a child whose sibling has a later end time. Its project's rank should remain stable.
5. Fold a host/project, reload the plugin, reopen the page, and confirm preferences survive.
6. Save different settings from two clients. Ensure a revision conflict does not overwrite the other client's collapse keys.
7. Disconnect/reconnect one host and replace its connection. Other hosts should remain usable, and stale workspaces should disappear after resync.
8. Open a workspace on the other host. Confirm its real route and workspace identity.
9. Repeat navigation, sorting, search, keyboard and sheet interaction on native iOS/Android.
10. Create a directory workspace and an isolated worktree from project actions on each test host; confirm project placement and native chat setup. Rename them and copy their paths/branches on desktop and phone. In a disposable worktree, cancel then confirm archival and verify the daemon's cleanup result. Disconnect a host while a form is open and verify writes are disabled.

The public API exposes state timestamps, not a durable execution-end log. Treat reported completion order as best-effort, especially after state changes or archival.
