# 咕咕机长（guguFly）项目审查与优化建议

> 审查时间：2026-07-16
> 项目版本：0.8.1
> 技术栈：Tauri 2 + Vite + Vanilla JS
> 审查范围：前端源码、Rust 后端、测试、CI/CD、构建与部署

---

## 执行摘要

咕咕机长是一个功能完整、动画效果丰富的桌面提醒应用。项目整体结构清晰，模块划分较为合理，测试覆盖也达到了一定水平（22 个测试文件，200 个测试用例）。

但在本次审查中发现 **11 个 ESLint 错误**、**1 个失败的测试用例**，以及若干**安全、健壮性和工程化**方面的高风险问题。建议优先处理安全边界问题（XSS、CSP、命令注入）、修复 UpdateManager 的 bug、统一更新机制，并增强 CI 的覆盖范围。

---

## 验证结果速览

| 检查项 | 结果 | 说明 |
|--------|------|------|
| ESLint | ❌ 11 errors, 36 warnings | `npm run lint` 失败 |
| 单元测试 | ❌ 1 failed / 199 passed | `UpdateManager.test.js` 失败 |
| 版本一致性 | ✅ 当前一致 | `package.json` / `tauri.conf.json` / `Cargo.toml` 均为 `0.8.1` |
| Rust 侧检查 | ⚠️ 未运行 | CI 中未覆盖 `cargo test` / `cargo clippy` |

---

## 一、严重问题（Critical / High）

### 1. `UpdateManager.js` 缓存分支未设置下载按钮链接，导致测试失败并存在运行时缺陷

**位置**：`src/settings/UpdateManager.js` 第 440–457 行

**问题**：在 `checkForUpdate` 的 `catch` 缓存分支中，只设置了 `updateInstallBtn`，未设置 `updateDownloadBtn.dataset.url`。与正常的网络成功分支（第 500 行附近）不一致。

**影响**：
- 测试 `tests/UpdateManager.test.js` 第 71 行期望标题为「发现新版本（缓存）」，实际进入网络成功分支得到「发现新版本」；
- 即使进入缓存分支，`updateDownloadBtn.dataset.url` 也会是 undefined，导致「手动下载」按钮无目标链接。

**建议**：
```js
// 在 catch 的 cached 分支中补充：
if (updateDownloadBtn) {
  updateDownloadBtn.classList.remove('hidden');
  updateDownloadBtn.dataset.url = cached.url || GITHUB_DOWNLOAD_URL;
}
```
同时测试应 mock `fetch` 为 reject，而不是依赖真实网络。

---

### 2. `installUpdate` 中 `progressInterval` 作用域错误，失败时会抛出二次异常

**位置**：`src/settings/UpdateManager.js` 第 228、251 行

**问题**：`progressInterval` 在 `try` 块内用 `let` 声明，但 `catch` 块中引用它。一旦 `invoke('download_and_install_update', ...)` 立即失败（例如网络不通或签名失败），`progressInterval` 不存在，导致 `clearInterval(progressInterval)` 抛出 `ReferenceError`。

**建议**：将 `progressInterval` 提升到函数作用域顶部：
```js
export async function installUpdate() {
  let progressInterval = null;
  // ... try/catch 中统一使用
  if (progressInterval) clearInterval(progressInterval);
}
```

---

### 3. 多处存在 XSS 风险，用户输入直接插入 `innerHTML`

**位置**：
- `src/ui/TaskRenderer.js` 第 225 行：搜索高亮使用 `label.innerHTML = labelText.replace(...)`；
- `src/ui/SettingsPanel.js` 第 205–216 行：导入预览直接拼接 `task.label` 到 HTML；
- `src/settings/UpdateManager.js` 第 75 行附近：`renderMarkdown` 将 release notes 的 Markdown 链接转为 `<a href="$2">`，未校验 URL 协议；
- `src/ui/TaskDetailDrawer.js` 第 109 行附近（需进一步确认）。

**问题**：虽然 `TaskRenderer` 对 `filterKeyword` 做了正则转义，但 `task.label` 是用户输入。若用户任务名为 `<img src=x onerror=alert(1)>`，在导入预览或搜索结果中会被执行。Release notes 的 Markdown 链接可能生成 `javascript:` 伪协议。

**建议**：
- 统一使用 `textContent` 或 DOM 创建节点；
- 必须渲染 HTML 时，先对用户文本进行 HTML 转义（`escapeHtml`）；
- 链接协议白名单限制为 `https?:`；
- 在 `TaskRenderer.js` 中，高亮也应使用 `DocumentFragment` 或安全替换，而非 `innerHTML`。

---

### 4. CSP 策略过宽 + asset 协议范围过大

**位置**：`src-tauri/tauri.conf.json` 第 31–35 行

```json
"csp": "default-src 'self'; ... style-src 'self' 'unsafe-inline'; script-src 'self'",
"assetProtocol": {
  "enable": true,
  "scope": ["**"]
}
```

**问题**：
- `style-src 'unsafe-inline'` 削弱了 CSP 防御；
- `assetProtocol.scope: ["**"]` 允许 webview 通过 `asset://` 访问本地任意路径。若存在 XSS，攻击者可直接读取用户文件。

**建议**：
- 将 `assetProtocol.scope` 限制到 `app_data_dir` 和 `videos` 等必要目录；
- 逐步移除 `unsafe-inline`，将样式迁移到 CSS 文件；
- 若必须保留内联样式，使用 nonce 或 hash（Tauri 支持 CSP nonce）。

---

### 5. `run_script` 命令存在命令注入与绕过风险

**位置**：`src-tauri/src/lib.rs` 第 172–193 行

**问题**：
- 虽然通过 `is_script_allowed` 过滤，但 Windows 分支使用 `cmd /C` 执行白名单命令；
- `rundll32.exe` 等命令若加入白名单，可调用任意 DLL 导出函数，本质上允许代码执行；
- 当前 `say` / `osascript` / `spd-say` / `mshta` 等 TTS 脚本将用户输入的 `ttsText` 直接拼入字符串，未对引号转义，存在命令注入（例如任务名包含 `"` 时）。

**建议**：
- 将 `run_script` 改为只执行预定义的、无参数的命令模板，或者完全移除脚本执行；
- 若必须保留，TTS 文本应作为参数数组传递，而不是字符串拼接；
- 对 `postFlight.script` 做严格白名单和沙箱审查。

---

### 6. `open_app` 命令未验证路径，可被滥用打开任意可执行文件

**位置**：`src-tauri/src/lib.rs` 第 463–487 行

**问题**：`open_app(path)` 直接将用户传入的字符串作为系统命令执行（`open` / `xdg-open` / `cmd /C start`），未验证路径是否存在、是否为应用、是否包含恶意参数。

**建议**：限制为只能通过文件选择器选择的路径，并校验扩展名和文件类型。

---

### 7. 更新下载使用硬编码 URL 且存在 shell 命令注入

**位置**：`src-tauri/src/lib.rs` 第 286–292 行

```rust
let script = format!(
    "hdiutil attach '{}' -nobrowse -quiet && cp -R '/Volumes/咕咕机长/咕咕机长.app' '/Applications/' && hdiutil detach '/Volumes/咕咕机长' -quiet && open -a '/Applications/咕咕机长.app'",
    dmg_path
);
let _ = std::process::Command::new("sh")
    .args(["-c", &script])
    .spawn();
```

**问题**：
- `dmg_path` 来自本地下载路径，若路径包含单引号，会中断 shell 命令；
- 使用 `sh -c` 拼接而非参数列表，存在命令注入风险；
- 未校验 DMG 签名或 hash，可能安装被篡改的包。

**建议**：
- 使用 `std::process::Command` 直接执行 `hdiutil`，并传递参数列表；
- 下载完成后校验签名或 checksum；
- 考虑统一使用 Tauri 官方 updater 插件，移除自定义下载逻辑。

---

### 8. 存在两套更新机制，可能冲突

**位置**：`src/settings/UpdateManager.js` 第 268–314 行（Tauri 官方 updater）和第 125–181 行（自定义下载）

**问题**：
- 同时使用了 Tauri 官方 `checkUpdaterPlugin` 和自定义 `invoke('check_latest_release')` / `download_and_install_update`；
- 两套机制下载地址、签名、安装逻辑不同，可能导致用户重复更新或安装未签名包；
- 自定义更新硬编码了 `https://github.com/pumf/guguFly/releases/latest/download/latest.json`，与 Tauri updater 配置重复。

**建议**：
- 统一使用 Tauri 官方 updater，移除自定义下载安装命令；
- 如果必须保留自定义路径（例如手动下载），应在 UI 上明确区分「官方更新」和「手动下载」，并避免两者同时触发。

---

### 9. 发布工作流存在竞态与签名风险

**位置**：`.github/workflows/release.yml`

**问题**：
1. `build-macos` 分两次调用 `action-gh-release` 上传到同一个 tag，若并发可能产生竞态或部分上传失败；
2. `generate-manifest` 依赖三个平台构建全部成功，但任何失败都会导致后续步骤无法生成 `latest.json`；
3. 使用 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 作为 secrets，但仓库未配置说明；
4. 产物重命名依赖 shell 通配符（`mv *.app.tar.gz ...`），若构建输出变化会出错；
5. 未在 CI 中校验 `Cargo.toml` / `tauri.conf.json` / `package.json` 三处版本一致。

**建议**：
- 使用 `actions/upload-artifact` 先收集三个平台的产物，再由单独的 `release` job 一次性发布；
- 在 README / 贡献文档中说明签名密钥配置；
- 通过 `tauri.conf.json` 的 `bundle` 配置固定产物名称，避免使用通配符；
- 增加版本一致性校验步骤。

---

### 10. 睡眠恢复可能误触发节假日/纪念日

**位置**：`src/tasks/AlarmChecker.js` 第 212–237 行

**问题**：`runSleepRecovery` 使用 `computeNextAlarmDate` 统一计算所有任务类型的下次触发时间。节假日/纪念日是按年一次的事件，不会在睡眠后的短窗口内「连续错过」。若系统长时间休眠，可能错误触发这些任务。

**建议**：
- 睡眠恢复只针对 `alarm` 类型任务；
- 节假日/纪念日应在日期切换时重置 `_lastTriggeredDate`，而不是在恢复窗口中补发。

---

### 11. 农历转换日期比较存在精度问题

**位置**：`src/tasks/LunarUtils.js` 第 22–24 行

```js
const candidate = new Date(sYear, sMonth - 1, sDay);
if (candidate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
```

**问题**：`candidate` 和右侧比较对象都默认带有 00:00:00 的时间，但 `now` 可能来自包含时间的 `afterDate`。当传入的 `afterDate` 是当天但时间较晚时，可能返回同一天，也可能跳到次年，行为不稳定。

**建议**：统一使用 `setHours(0, 0, 0, 0)` 归零时间后再比较：
```js
const candidate = new Date(sYear, sMonth - 1, sDay);
candidate.setHours(0, 0, 0, 0);
const after = new Date(now);
after.setHours(0, 0, 0, 0);
if (candidate >= after) { ... }
```

---

## 二、中等问题（Medium）

### 12. 任务列表全量重建，缺少虚拟滚动或增量更新

**位置**：`src/ui/TaskRenderer.js` 第 60 行附近

**问题**：每次 `renderTasks` 都会清空 `taskListEl.innerHTML = ''` 并重新创建所有 DOM 节点。任务数量较多时，会造成明显的重排和重绘。

**建议**：引入文档片段或 Diff 更新；长列表使用虚拟滚动或分组懒渲染。

---

### 13. 历史统计使用 O(n·m) 查找

**位置**：`src/ui/HistoryPanel.js` 第 71–76 行

**问题**：`buildDailyTaskMap` 中对每个 task、每一天都调用 `flightLog.find`，日志增长后性能下降。

**建议**：预先将 `flightLog` 转为 `Map<date, entry>`。

---

### 14. 飞行日志全部加载内存

**位置**：`src/storage.js` 第 154–160 行

**问题**：90 天日志一次性加载，日积月累可能占用大量内存。

**建议**：按需求分页加载，或统计面板只读取聚合后的数据。

---

### 15. Canvas 飞行窗口不复用

**位置**：`src/flight/FlightOrchestrator.js`

**问题**：每次触发飞行都创建新的 `WebviewWindow`，窗口创建和销毁成本较高。

**建议**：考虑维护一个窗口池，或复用隐藏窗口。

---

### 16. 飞行页面 URL 参数缺乏验证

**位置**：`src/flight.js` 第 33–70 行

**问题**：从 URL 或 `localStorage` 读取的 `w`、`h`、`speed`、`effect`、`plane`、`particle` 等参数直接用于 Canvas 尺寸和动画配置。`effect`、`plane`、`particle` 等字符串未验证是否在白名单，非法值可能导致动画异常或安全边界问题。

**建议**：对所有枚举值做白名单校验，非法值回退到默认值；尺寸限制上限（已做）但也可以限制下限。

---

### 17. `main.js` 职责过重，初始化耦合度高

**位置**：`src/main.js` 第 1–170 行

**问题**：集中了 50+ 个模块的导入、DOM 引用解构、依赖注入和状态创建。虽然后续已拆出 `app/` 子模块，但 `main.js` 仍然是事实上的「上帝模块」。

**建议**：将初始化流程收敛到一个 `App.js` 或 `bootstrap.js` 的单一入口，按领域分组注入。

---

### 18. 全局状态分散且存在跨模块隐式依赖

**位置**：`src/flight/FlightOrchestrator.js` 第 12–71 行

**问题**：`activeFlightJob`、`flightQueue`、`flightSequences`、`isMuted` 等 20 余个状态变量以模块级 `let` 形式存在，并通过 `export function setXxx` 暴露。多个模块依赖这些隐式状态，难以追踪生命周期。

**建议**：引入一个轻量状态管理器或事件总线，集中管理飞行任务队列、静音状态、视频窗口引用等。

---

### 19. 缺少数据导入校验与版本兼容提示

**位置**：`src/ui/SettingsPanel.js` 第 199–219 行

**问题**：导入预览只读取 `data.tasks`，未校验字段类型、版本兼容性，也未限制导入文件大小。

**建议**：
- 增加 JSON Schema 校验；
- 导入前做版本兼容提示；
- 限制文件大小（例如 5MB）。

---

### 20. 缺少崩溃/异常上报机制

**位置**：`src-tauri/src/lib.rs` 第 616–647 行附近

**问题**：仅写入本地临时日志，未上传或主动提示用户导出日志。

**建议**：至少提供「导出日志」入口，或接入轻量崩溃上报。

---

### 21. 循环依赖倾向

**位置**：`src/tasks/CountdownTimer.js` 导入 `AlarmChecker.getAllUpcomingTasks`，而 `AlarmChecker.js` 本身依赖倒计时状态。

**建议**：将「获取 upcoming tasks」逻辑抽取到独立的 `TaskScheduler.js`，解除双向依赖。

---

## 三、低优先级问题（Low）

### 22. ESLint 配置与代码质量问题

**位置**：`eslint.config.mjs` 第 17 行

**问题**：`no-console` 被关闭，生产代码中大量 `console.error`/`console.warn`，可能泄露敏感信息。

**建议**：保留错误日志，但使用 `tauri-plugin-log` 统一输出，并关闭前端 console。

---

### 23. 未使用变量与拼写错误

**位置**：`src/main.js` 第 50 行、`src/ui/ModalController.js` 多处

**问题**：批量导入的 `enterSelectionMode` 等未使用；多处未使用解构变量。

**建议**：清理未使用导入，或开启更严格的 `no-unused-vars` 配置。

---

### 24. 版本号硬编码多处

**位置**：`package.json` 第 3 行、`tauri.conf.json` 第 4–5 行及第 17 行、`Cargo.toml` 第 3 行

**问题**：三处版本需要手动同步，容易遗漏。

**建议**：使用脚本或 CI 步骤统一 bump 版本，并增加版本一致性校验。

---

### 25. 缺少无障碍与国际化完整覆盖

**问题**：部分动态生成的按钮缺少 `aria-label`；i18n 已支持中英文，但一些动态拼接的字符串未走 `t()`。

**建议**：为所有交互元素添加 `aria-label`；统一字符串使用 `t()` 或 `t()` 的占位符。

---

## 四、测试与 CI 问题

### 26. `UpdateManager.test.js` 测试失败

**结果**：
```
FAIL tests/UpdateManager.test.js > UpdateManager > shows cached newer release info when network fails
AssertionError: expected '发现新版本' to be '发现新版本（缓存）'
```

**根因**：测试未 mock `fetch`，`checkForUpdate` 真实请求 GitHub API 并返回最新 release，导致进入「发现新版本」分支而非缓存失败分支。

**建议**：
1. 修复 `UpdateManager.js` 缓存分支设置 `updateDownloadBtn.dataset.url` 的 bug；
2. 测试中 mock `fetch` 为 `Promise.reject(new Error('network'))`；
3. 测试环境使用 `msw` 或 `vi.fn` 统一拦截网络。

---

### 27. CI 未覆盖 Rust 测试与 clippy

**位置**：`.github/workflows/ci.yml`

**问题**：仅执行 `cargo check`，没有 `cargo test` 和 `cargo clippy`，也未对前端 lint 做失败阻断。

**建议**：
- 增加 `cargo clippy -- -D warnings` 和 `cargo test` 步骤；
- 前端 CI 加入 `npm run lint`；
- 增加 Windows 和 Linux 的构建矩阵，至少做编译验证。

---

## 五、优先修复建议

按优先级排序，建议按以下顺序处理：

1. **修复 `UpdateManager` 缓存分支与测试失败**（影响测试与发布流程）
2. **修复 `progressInterval` 作用域错误**（运行时稳定性）
3. **统一使用 `textContent` / DOM 创建，消除 XSS 风险**（安全）
4. **收紧 CSP 与 `assetProtocol` 范围**（安全）
5. **修复 `run_script` / `open_app` / 自定义下载中的命令注入风险**（安全）
6. **统一更新机制或明确区分两套路径**（工程化）
7. **重构 `release.yml`，使用 artifact 收集 + 单次发布**（发布稳定性）
8. **修复 `AlarmChecker` 睡眠恢复逻辑**（业务正确性）
9. **修复 `LunarUtils` 日期精度问题**（业务正确性）
10. **在 CI 中增加 `npm run lint` / `cargo clippy` / `cargo test`**（工程质量）

---

## 六、总结

咕咕机长在用户体验和功能丰富度上表现出色，但工程化和安全边界需要加强。当前最紧迫的是：

- **立即修复**：ESLint 错误、失败测试、`UpdateManager` 作用域 bug；
- **短期处理**：XSS 风险、CSP 与 asset 协议、命令注入、更新机制统一；
- **中期规划**：状态管理重构、CI 矩阵扩展、性能优化（虚拟滚动、日志分页）。

这些问题大多是可落地的，修复后可显著提升项目的可维护性、安全性和发布稳定性。
