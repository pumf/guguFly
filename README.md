# 咕咕机长

> 一个更轻巧、更有趣的桌面提醒工具。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](#平台支持)
[![Release](https://img.shields.io/github/v/release/pumf/guguFly)](../../releases/latest)
[![Stars](https://img.shields.io/github/stars/pumf/guguFly)](../../stargazers)
[![GitHub Sponsors](https://img.shields.io/badge/sponsor-pumf-EA4AAA?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/pumf)

咕咕机长基于 `Tauri 2 + Vite + Vanilla JS` 构建，面向日常提醒、倒计时、节日和纪念日场景。它不只是一条弹出的提醒文字，而是把任务提示做成了更有桌面感的**飞行动画**体验，并支持自定义图片、自定义音频和多种飞行表现形式。

[📸 查看截图](#界面预览) · [🚀 快速开始](#快速开始) · [💡 功能概览](#功能概览) · [📦 下载安装](../../releases/latest)

---

## ✨ 为什么选择咕咕机长

- 🎯 **桌面原生体验** — 飞行窗口叠加在所有应用之上，关屏也能看到
- 🎨 **高度可定制** — 飞机、轨迹、尾焰、文案框、提示音都能改
- 🪶 **极致轻量** — 基于 Tauri 2，安装包仅 ~10MB，内存占用 < 50MB
- 🔌 **本地优先** — 数据完全在本地，无需注册账号即可使用全部核心功能
- 🔗 **可扩展** — 支持 `gugufly://` URL Scheme 与外部应用联动

## 界面预览

> 仓库首页 `docs/screenshots/` 下有完整截图。

| 主界面 | 飞行设置 | 统计面板 |
|:------:|:--------:|:--------:|
| 任务列表 + 颜色标签 + 起飞按钮 | 12 个音色 + 飞行节奏 + 外观样式 | 累计/本周/类型分布 |

## 功能概览

### 任务管理
- 4 种任务类型：定时 / 倒计时 / 节假日 / 纪念日
- 任务启用、停用、编辑、删除
- 倒计时：开始 / 暂停 / 停止
- 重复：每周特定日期
- 搜索框：实时过滤任务名 + 文案
- 类型筛选 chip：全部 / 定时 / 倒计时 / 节假日 / 纪念日
- 颜色标签：8 种颜色帮助视觉分类
- 任务级自定义图片（覆盖全局设置）
- 飞行方式：一次性 / 连续循环 / 间隔循环

### 飞行动画
- 4 种飞行节奏效果：经典直穿 / 自然滑过 / 仪式感（弧线）/ 利落提醒 / 活泼一点（S 形）
- 6 套飞机样式：经典 / 火箭 / 蝴蝶 / 喷射 / 纸飞机 / 飞碟
- 6 套尾焰粒子：飘带 / 火焰 / 星点 / 尾迹 / 闪光 / 云团
- 6 套文案框样式：圆角 / 锐角 / 柔圆 / 简约条 / 玻璃感 / 贴纸感
- 3 个文案框位置：上方 / 居中 / 下方
- 飞行高度：上方 / 居中 / 下方
- 飞行速度：超慢 / 慢速 / 正常 / 快速

### 声音
- 12 种内置音色：咻 / 叮咚 / 铃声 / 柔和 / 风铃 / 脉冲 / 鸟鸣 / 钟声 / 成功 / 水泡 / 激光 / 晨光
- 播放方式：一次 / 循环
- 自定义音频上传（mp3 / wav / ogg）
- 试听 / 结束试听

### 桌面体验
- 系统通知（macOS Notification Center）
- 托盘菜单：开始 / 暂停 / 停止 / 静音 / 打开主窗口 / 退出
- 紧急降落按钮（一键停止所有飞行 + 清空 streak）
- ESC 快捷键触发紧急降落
- 本地持久化（自动保存）
- 浅色 / 深色 / 跟随系统主题
- 飞行时优化焦点占用，不抢输入
- 开机自启动

### 集成
- URL Scheme `gugufly://add?msg=...` 接受外部唤起
- 全局快捷键（macOS: ⌘⌥S/P/Q, 其他: Ctrl+Alt+S/P/Q）
- 飞行统计面板（累计 / 本周 / 7 天柱状图 / 类型分布）

### 数据
- JSON 导入 / 导出（带版本号和校验）
- 90 天飞行日志（自动清理）

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run tauri dev
```

> 第一次启动会下载 Rust 依赖和编译，时间较长。

### 构建生产版本

```bash
npm run tauri build
```

产物在 `src-tauri/target/release/bundle/`。

## 平台支持

| 平台 | 状态 | 安装包 |
|---|---|---|
| **macOS** (Apple Silicon) | ✅ 主要平台，全部能力 | `.dmg` |
| **Windows** (x64) | ✅ | `.exe` (NSIS) |
| **Linux** (Ubuntu 24.04) | ✅ | `.AppImage` / `.deb` |

> Linux 上运行需要：`libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev librsvg2-dev patchelf`

## 使用说明

### URL Scheme（外部唤起）

```bash
# 创建定时任务
open "gugufly://add?msg=开会&type=alarm&hour=15&minute=30"

# 创建倒计时
open "gugufly://add?msg=番茄钟&type=countdown&mins=25"

# 创建纪念日
open "gugufly://add?msg=结婚纪念&type=anniversary&month=5&day=20&hour=9&minute=0"

# 工作日重复
open "gugufly://add?msg=站会&type=alarm&hour=10&minute=0&days=1,2,3,4,5"
```

支持参数：`type`、`msg`、`hour`、`minute`、`mins`、`secs`、`month`、`day`、`days`、`holidayKey`

### 全局快捷键

- `⌘⌥S` (macOS) / `Ctrl+Alt+S` — 开始倒计时
- `⌘⌥P` (macOS) / `Ctrl+Alt+P` — 暂停所有倒计时
- `⌘⌥Q` (macOS) / `Ctrl+Alt+Q` — 停止所有倒计时
- `ESC` — 紧急降落（停止所有飞行 + 清空 streak）

## 截图

完整截图见 [`docs/screenshots/`](docs/screenshots/)，README 顶部预览使用了：

- `home.png` — 主界面（任务列表 + 搜索 + 起飞按钮）
- `flight-settings.png` — 飞行设置抽屉
- `task-modal.png` — 新建任务模态
- `settings-modal.png` — 设置模态（主题 + 备份）
- `stats.png` — 飞行统计面板

## 开发

### 项目结构

```
guguFly/
├── index.html              # 主界面
├── flight.html             # 飞行窗口
├── src/
│   ├── main.js             # 主入口 + 模块依赖注入
│   ├── flight.js           # 飞行动画渲染（Canvas）
│   ├── style.css           # 全局样式（2500+ 行）
│   ├── storage.js          # Tauri Store 封装 + localStorage 回退
│   ├── timer.js            # AccurateTimer 高精度倒计时
│   ├── sounds.js           # 12 种 Web Audio 音色合成
│   ├── quotes.js           # 随机文案库
│   ├── backup.js           # 任务导入/导出
│   ├── utils.js            # 共享工具函数
│   ├── tasks/              # 领域模型层
│   │   ├── TaskFactory.js      # 任务工厂 + ID 生成
│   │   ├── TaskUtils.js        # 排序/过滤/清洗/日期计算
│   │   ├── TaskColors.js       # 8 种颜色标签定义
│   │   ├── CountdownTimer.js   # 倒计时控制
│   │   ├── AlarmChecker.js     # 定时任务秒级检查
│   │   └── HolidayPresets.js   # 内置节假日预设
│   ├── ui/                 # 界面组件
│   │   ├── TaskRenderer.js     # 任务列表渲染
│   │   ├── ModalController.js  # 新建/编辑模态框
│   │   ├── ModalEvents.js      # 模态事件绑定
│   │   ├── StatsPanel.js       # 飞行统计面板
│   │   ├── HistoryPanel.js     # 任务触发历史
│   │   ├── HeroSection.js      # 顶部英雄区
│   │   ├── Toast.js            # Toast 通知
│   │   ├── ColorPicker.js      # 颜色选择器
│   │   ├── Logo.js             # Title Logo 更新
│   │   ├── AudioSystem.js      # 音频播放管理
│   │   ├── NotificationManager.js # 系统通知
│   │   ├── MediaUpload.js      # 图片/音频上传
│   │   ├── MiniWindow.js       # 迷你悬浮窗
│   │   ├── FlightPreview.js    # 飞行预览
│   │   ├── TaskFilter.js       # 搜索 & 筛选
│   │   └── SettingsPanel.js    # 设置面板
│   ├── settings/           # 持久化配置
│   │   ├── SettingsManager.js  # 设置加载/存储
│   │   ├── ThemeManager.js     # 主题切换
│   │   ├── UpdateManager.js    # 版本更新检查
│   │   └── FlightSync.js       # 飞行配置同步
│   └── flight/             # 飞行编排
│       ├── FlightOrchestrator.js # 飞行窗口创建/队列
│       ├── FlightTrigger.js     # 触发逻辑（计数/连飞）
│       ├── FlightPresets.js     # 5 个场景预设
│       ├── Emergency.js         # 紧急降落
│       ├── DeepLink.js          # URL Scheme 解析
│       └── TauriListeners.js    # 托盘/快捷键事件
├── src-tauri/              # Rust 后端
│   ├── src/lib.rs          # 托盘 + 快捷键 + 11 个命令
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
├── scripts/
│   └── capture_screenshots.py
└── .github/workflows/
    ├── ci.yml
    └── release.yml
```

### 调试

```bash
# 仅前端
npm run dev

# Tauri 完整开发
npm run tauri dev

# 重新生成截图
python3 scripts/capture_screenshots.py
```

### 发布检查

发版前可按清单逐项验证：[`docs/release-checklist.md`](docs/release-checklist.md)

## 🤝 贡献

欢迎 PR、Issue、Feature Request！提交前请：

1. Fork 仓库
2. 创建 feature 分支 (`git checkout -b feature/awesome`)
3. 提交清晰的 commit message
4. 推送到 fork
5. 开 PR 并描述改动

## 📜 路线图

### v0.6（进行中 — 稳定性 & 安全性 & 用户体验）
- [x] CSP 策略启用
- [x] `run_script` 白名单安全限制
- [x] 任务删除确认弹窗
- [x] 图片上传大小限制
- [x] 工程结构拆分（`main.js` 模块化）
- [x] 关键交互测试补齐（深链 / 导入 / 倒计时 / 紧急降落等）
- [ ] 更多飞行动画模板（螺旋 / 心形 / 8 字）
- [ ] 键盘快捷键（Cmd+N 新建任务）
- [ ] 应用内 onboarding
- [ ] 成就系统（连飞 7 天 / 100 次）
- [ ] 深色主题完整覆盖

### v1.0（Pro 计划）
- [ ] ☁️ 云端备份 + 多设备同步（WebDAV 通用协议）
- [ ] 📊 数据洞察面板（vs 当前简化版）
- [ ] 🤖 AI 智能建议
- [ ] 🎨 主题市场 + 创作者分成
- [ ] 👥 家庭共享清单

> Pro 计划是云服务订阅（按月 / 按年）。**核心功能永远开源免费**，Pro 只提供"更省事 + 额外价值"。

## 💖 赞助

如果你喜欢这个项目：

- ⭐ 给仓库点 Star
- 🐛 报告 Bug 或建议新功能
- 📢 推荐给朋友
- 💰 [GitHub Sponsors](https://github.com/sponsors/pumf) | [爱发电](https://afdian.net/)

## 📄 License

[MIT](LICENSE) — 自由使用、修改、分发。

## 平台 Logo

<p align="left">
  <a href="#"><img src="https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white" alt="Tauri"></a>
  <a href="#"><img src="https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white" alt="Vite"></a>
  <a href="#"><img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript"></a>
</p>
