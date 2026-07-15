# v0.9.0 打磨地基 · 详细设计方案

> 本文是 `docs/next-phase-plan.md` 中 **阶段一（P0）** 的落地设计。
> 每条均给出：现状代码证据 → 目标 → 功能 / 界面 / 操作 → 技术实现（文件/函数）→ 验收 → 工作量。
> 关键前置约束（决定方案边界）：
> - 主窗口 `src-tauri/tauri.conf.json:21-22` 锁死 `minWidth:620 / maxWidth:620`，响应式第一步必须放开。
> - 迷你窗已存在：`src/ui/MiniWindow.js:102` 创建独立 `WebviewWindow('gugufly-mini', {url:'/mini.html'})`，但 `public/mini.html` + `public/mini.js` **不走 Vite 构建** → 双份维护、易漂移。
> - "before init" 守卫仅 3 处：`FlightOrchestrator.js:395`、`QuickCreateBar.js:5`、`ModalController.js:5`。
> - 测试用 vitest，纯函数可直接 import（范式见 `tests/TaskFactory.test.js`）。

---

## ① 旗舰功能补测试

### 现状
`tests/` 已覆盖 AlarmChecker / TaskUtils / FlightTrigger 等 22 个文件，但三大旗舰能力零测试：
- `src/tasks/QuickCreateParser.js`（`parseQuickInput` / `formatPreview`，纯函数，依赖 `t/ta/HOLIDAY_PRESETS`）
- `src/tasks/PomodoroTimer.js`（`startPomodoro` / `skipPomodoroPhase` / `getPomodoroState`）
- `src/tasks/HolidayPresets.js`（法定 + 二十四节气数据）

### 目标
补齐单测 + CI 门槛，守住自然语言创建、番茄钟、节气判断。

### 功能设计
- **QuickCreateParser.test.js**（纯函数，直接 import）
  - 倒计时：`'25分钟番茄'` → `{type:'countdown', duration:1500}`；`'1小时开会'` → 3600；`'10秒' ` → 10
  - 中文时间：`'三点钟开会'` → alarm hour 15；`'下午3点半'` → 15:30；`'明天9点'` → alarm + `isTomorrow`
  - 重复：`'周一至周五站立会'` → weekly days `[1,2,3,4,5]`；`'每天吃药'` → everyday `[1..5]`
  - 节假日：`'国庆'` → holiday `national_day`；`'中秋农历'` → lunar true
  - 纪念日：`'老婆生日5月20日'` → anniversary month5 day20
  - 边界：空串/纯空白 → `null`；`formatPreview` 各类型展示串正确
  - 注意：`parseQuickInput` 内部调用 `t()`/`ta()` 与 `HOLIDAY_PRESETS`，测试 setup 里 `initI18n({initialLang:'zh-CN'})` 即可（无需 Tauri）
- **PomodoroTimer.test.js**（设计阶段第一步：先读该文件确认是否纯 JS）
  - 若内部仅用 `setInterval`/`AccurateTimer`（纯 JS）→ 用 vitest fake timers 控制
  - 用例：`startPomodoro(25)` → state.active + phase `work` + remaining≈1500；`pausePomodoro` → `_status:'paused'`；`resumePomodoro`；`skipPomodoroPhase` → `shortBreak`；轮次到 4 次后转 `longBreak`；`stopPomodoro` → active false
  - 若发现依赖 Tauri-only API → 抽取计时逻辑为纯函数再测，或 mock `invoke`
- **HolidayPresets.test.js**（数据完整性）
  - 二十四节气数量 = 24 且 `lunar` 标志正确；法定假日集合数量与 `label` 非空；`getHolidayByKey('national_day')` 返回正确 month/day

### 技术实现
- 沿用现有 vitest 范式（`import { describe,it,expect } from 'vitest'`），无需新增工具链
- `package.json` 的 `test` 脚本加 `--coverage`，CI（`ci.yml`）设阈值门槛（如 functions ≥ 70%）确保不回退

### 验收
- `npm test` 全绿；release 流水线 `ci.yml` 必跑测试
- 新增 3 个测试文件，覆盖上述分支

### 工作量
约 1 周（含读 PomodoroTimer 确认纯 JS 的探路）

---

## ② 主窗响应式 + 常驻迷你条（本阶段改动最大、价值最高）

### 现状
- 主窗口宽度被 `tauri.conf.json` 锁死 620 → 没有缩放空间
- `style.css` 仅 `style.css:3226` 一处 `@media (max-width:480px)` → 小窗无适配
- 迷你窗已实现且可拖拽（`mini-drag-end` 监听 `MiniWindow.js:116`）、6 格位置选择（`miniPosGrid` + `updateMiniPosGridActive`）、不抢焦点（`focus:false`）、常驻置顶（`alwaysOnTop:true`）；但样式/逻辑独立于主工程

### 目标
主界面随窗口宽度自适应；迷你窗统一进 Vite 构建消除漂移，并补透明度/全屏隐藏。

### 功能设计
**A. 放开窗口尺寸**（`src-tauri/tauri.conf.json`）
- `minWidth:620 → 360`，`maxWidth:620 → 移除或 960`，`minHeight:760 → 600`
- 窗口可窄可宽，主界面 reflow

**B. 主界面响应式 CSS**（`src/style.css`）
- 新增断点（用 flex/grid `auto-fit` + CSS 变量，避免写死像素）：
  - `≤560px`：Hero 区竖向堆叠；任务列表由双列变单列；搜索/筛选栏换行
  - `≤720px`：飞行设置配置面板由多列变单列
  - `≥960px`：任务卡片可双列网格（提升信息密度）
- 当前 480px 断点并入体系

**C. 常驻迷你条统一进 Vite 构建**（消除双份维护）
- `vite.config.js` 的 rollup `input` 增加 `mini: resolve(__dirname,'mini.html')`
- 把 `public/mini.html` 移到根目录作构建入口，`mini.js` 改为 ESM，`import` 主工程的 `updateMiniWindow` / `formatUpcomingTime` / `i18n`，复用主工程 CSS 变量（替换 `mini.html` 里的内联 `linear-gradient` 硬编码）
- `tauri.conf.json` 的 mini url 仍为 `/mini.html`（由 Vite 输出到 `dist/mini.html`）

**界面 / 操作增强**
- 设置 → 迷你条：新增「透明度」滑块 → 写入 CSS 变量 `--mini-opacity`，`createMiniWindow` 创建时 apply
- 新增「全屏时自动隐藏」：监听前台窗口全屏状态（Tauri window `onResized`/`isFullscreen` 或轮询活跃 app）
- 位置选择保留 6 格（`miniPosGrid`）；拖拽移动已支持

### 技术实现要点
- 窗口尺寸改动后，必须回归各面板在 360 / 620 / 960 三档的表现（原本按 620 设计）
- 迷你窗改 Vite 入口时同步改 `tauri.conf.json` mini url 指向（`/mini.html` 不变，但来源从 public 拷贝改为 Vite 产物）

### 验收
- 拖拽窗口边缘缩放，主界面平滑 reflow，无溢出/错位
- 窄窗（360）任务列表单列可读；宽窗（960）双列不空洞
- 迷你窗用 Vite 构建产物运行，样式与主工程一致；透明度/全屏隐藏生效

### 工作量
约 1.5 周（窗口放开 + 三档响应式 + 迷你窗 Vite 化 + 增强项）

---

## ③ i18n 收口

### 现状
i18n 机制完善（`src/i18n/index.js` 有 `t/ta/interpolate` + `zh-CN`/`en` 双表），但仍有硬编码中文兜底：
- `src/ui/StatsPanel.js:94` 手写 `.replace('{{count}}', ...)`
- `src/settings/UpdateManager.js:209 / 245` 未走 `t()`
- `src/flight/FlightTrigger.js:12` 守卫 `_t ? _t(...) : `${count} 次``（实际走 i18n，但守卫暴露中文兜底风险）
- `src/utils.js:6` confirm 默认中文（已由 `main.js:306` 的 `setConfirmI18n(t)` 覆盖）

### 目标
消除硬编码中文兜底，统一 `t()` 参数化；英文模式下不再露中文。

### 功能设计
- `StatsPanel.js:94`：`text.replace('{{count}}', n)` → `t('stats.xxx', { count: n })`；在 `zh-CN.js` / `en.js` 补对应 key（用 `{{count}}` 占位）
- `UpdateManager.js:209/245`：定位两处中文（如"发现新版本""已是最新"），改 `t(...)` 并补翻译 key
- `FlightTrigger.js:12`：去掉静默中文兜底，改为未注入 `_t` 时 `throw new Error('FlightTrigger.t not initialized')` 或补英文默认值，与 ④ 的解耦思路一致
- `utils.js:6`：保留 `confirm.title/ok/cancel` 中文为 fallback，但确认 `en.js` 含这三 key（`setConfirmI18n` 已覆盖）

### 技术实现要点
- 新增护栏：在 `lint` 或 CI 加正则扫描 `src/**/*.js` 中出现在字符串字面量的中文（`[\u4e00-\u9fa5]`），排除 i18n 翻译表与注释，作为收口检查
- 切换英文（`setLanguage('en')`）后逐页验证 toast / 确认框 / 更新提示无中文残留

### 验收
- 英文模式下全部 UI 文案（含统计、更新、确认）走 `t()`，无硬编码中文
- 护栏脚本在 CI 通过

### 工作量
约 0.5 周

---

## ④ 初始化顺序解耦

### 现状
3 处模块级守卫，调用顺序错就**静默失败**（warn 或 no-op）：
- `FlightOrchestrator.js:395` `let showToast = msg => console.warn('...called before init')`
- `QuickCreateBar.js:5` `let showToastFn = ...`
- `ModalController.js:5` `let showToastFn = ...`
main.js 已大量用依赖注入（`applySettings` / `initCoreModules` 的 `deps` 对象），风格可复用。

### 目标
用显式依赖注入替换守卫；未初始化时 fail-loud，消除"静默 no-op / 静默中文"。

### 功能设计（推荐方案 A，低风险可测）
- 将三处默认 warn 函数改为 `throw new Error('<module> not initialized')`
- 在 `tests/bootstrap.test.js`（已存在）扩充"未初始化调用即抛错"用例，保证守卫不再静默
- `main.js` 已正确按序调用 `setToastFn` / `initQuickCreate` / `initModalEvents`，顺序本身没问题，改守卫仅为消除隐患
- （可选方案 B，更彻底但风险高）移除模块级 fallback，改为 init 函数必须接收依赖，并在 `bootstrap` 增加"依赖就绪断言"图——本期不推荐，留 v0.9.x 视情况

### 技术实现要点
- 仅改 3 个文件的默认函数体 + 1 个测试文件，不动调用方
- 确保 `setToastFn(showToast)` 在 `FlightOrchestrator` 任何触发前被调用（main.js 已在 init 链路内）

### 验收
- 单测：未初始化直接调用 → 抛错
- 集成：正常启动流程无报错，行为与现状一致

### 工作量
约 0.5 周

---

## 交付与里程碑
- 四项全部完成 → 发 **v0.9.0 稳定版**
- 每项为完成定义验收清单 + 对应测试
- 顺序建议：④ 解耦（最小风险，先立护栏）→ ① 补测试（立安全网）→ ③ i18n 收口 → ② 响应式 + 迷你窗（最大改动，放最后集中回归）

## 风险与注意
- ② 放开 `maxWidth` 会改变现有按 620 宽设计的布局，需在三档宽度回归
- 迷你窗改 Vite 入口时，`tauri.conf.json` 的 mini url 指向需保持 `/mini.html`（来源由 public 拷贝改为 Vite 产物）
- ① 中 PomodoroTimer 测试前**必须先读该文件**确认是否为纯 JS（否则方案调整）
