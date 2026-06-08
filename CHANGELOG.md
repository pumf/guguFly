# Changelog

咕咕机长的所有重要变更都会记录在这里。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

## [0.3.1] - 2026-06-08

### 🐛 修复
- **托盘图标无响应**（根因：tray-icon.png 构建时未打包进 .app bundle，点击事件回调被释放但图标残留）
- **飞行时内置声音不播放**（根因：AudioContext 未被 `unlock`，`playOscillator` 的 try/catch 静默吞掉错误）
- 修复后：图标 `include_bytes!` 嵌入二进制，声音调用 `await unlockAudioIfNeeded()` 解锁后播放

## [0.3.0] - 2026-06-08

### ✨ 新增

#### 飞行设置大幅改进
- **场景预设**：5 个一键应用的飞行风格组合
  - 🏢 工作模式（自然滑过 + 经典）
  - ⚡ 速战速决（利落 + 喷射）
  - 🎉 节日氛围（活泼 S 形 + 蝴蝶 + 鸟鸣）
  - 💝 纪念日（仪式感弧线 + 钟声）
  - 🌙 夜间低调（直线 + 底部 + 柔和）
- **效果视觉预览**：5 个飞行动画现在有动态预览
  - 每个效果用 1 个移动圆点展示真实路径
  - 直觉对比"经典直穿"vs"仪式感（弧线）"vs"活泼（S 形）"
  - 选中态用蓝色边框 + 加亮文字
- **窗口高度增加**：620×730 → 620×820，给设置和统计更多呼吸空间

#### 桌面集成修复
- **修复菜单栏图标点击无响应**：
  - 左键单击 = 显示并呼出主窗口（macOS 标准行为）
  - 右键单击 = 弹出菜单
  - 即使主窗口被最小化也能从托盘唤醒

#### 工程化
- v0.3.0 release pipeline（macOS DMG + GitHub Actions 自动 Windows/Linux）

## [0.2.0] - 2026-06-05

### ✨ 新增

#### 核心功能
- 任务搜索：实时过滤任务名 + 文案
- 类型筛选：5 个 chip（全部 / 定时 / 倒计时 / 节假日 / 纪念日）
- 任务颜色标签：8 种颜色帮助视觉分类
- 任务级自定义图片：覆盖全局设置
- 飞行轨迹模式：弧线（ceremony）、S 形（playful）
- macOS 系统通知：飞行触发时弹出系统通知
- URL Scheme `gugufly://add?msg=...`：外部应用唤起
- 全局快捷键 macOS (⌘⌥S/P/Q) + Windows/Linux (Ctrl+Alt+S/P/Q)
- ESC 紧急降落快捷键
- 飞行统计面板：累计/本周/7 天柱状图/类型分布
- 任务数据 JSON 导入/导出（带版本校验）
- 12 个内置音色（咻/叮咚/铃声/柔和/风铃/脉冲/鸟鸣/钟声/成功/水泡/激光/晨光）
- 浅色/深色/跟随系统主题

#### 跨平台
- Linux 适配：webkit2gtk + pkg-config
- GitHub Actions CI：macOS / Linux / Windows 三平台自动构建

#### 工程化
- 卸载浏览器降级路径，保持桌面端专注
- Vite 8 升级
- 5 张自动生成的 README 截图（`scripts/capture_screenshots.py`）
- release.yml 多平台打包
- 移除 marketing-site 混入，单独仓库管理

### 🐛 修复
- `_remaining` 初始化错误（`t.duration || t.duration` → `t._remaining ?? t.duration`）
- 倒计时暂停状态现在能持久化跨 App 重启
- `getCurrentWebviewWindow` 加防御性 try/catch
- ESC 紧急降落不会在模态打开时误触发
- HTML 静态加 `hidden` 避免首屏闪烁
- 移除 `urlencoding` 死代码

### 📦 体积
- 压缩 `logo.png` 1.1MB → 83KB（−92%）
- 压缩 `fly_logo.png` 800KB → 18KB（−98%）

## [0.1.0] - 早期版本

### ✨ 初始功能
- 4 种任务类型：定时 / 倒计时 / 节假日 / 纪念日
- 飞行动画：4 种效果、6 套飞机、6 套尾焰、6 套文案框
- 自定义图片和音频
- 托盘菜单
- macOS 启动自启
- 本地持久化
