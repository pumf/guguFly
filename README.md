# 咕咕机长

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![Desktop App](https://img.shields.io/badge/Desktop-App-4B5563)
![Platform](https://img.shields.io/badge/Platform-macOS-lightgrey)

一个更轻巧、更有趣的桌面提醒工具。

咕咕机长基于 `Tauri + Vite` 构建，面向日常提醒、倒计时、节日和纪念日场景。它不只是一条弹出的提醒文字，而是把任务提示做成了更有桌面感的飞行动画体验，并支持自定义图片、自定义音频和多种飞行表现形式。

## 版本信息

- 当前桌面版本：`0.1.0`
- 当前仓库主分支：`main`
- 最近一轮重点更新：
  - 飞行设置抽屉化
  - 多种飞行效果与外观样式扩展
  - 自定义音频文件名展示
  - `试听 / 结束试听`
  - 飞行时优先播放自定义音频
  - 主界面布局和顶部区域持续优化

## Releases

如果后续发布正式构建版本，建议在这里放 GitHub Releases 链接：

- [Releases](../../releases)

如果暂时还没有发布页，也可以先保留这个入口，后续补充安装包说明。

## 目录

- [项目亮点](#项目亮点)
- [界面预览](#界面预览)
- [功能概览](#功能概览)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [使用说明](#使用说明)
- [项目结构](#项目结构)
- [当前进展](#当前进展)
- [适用场景](#适用场景)
- [License](#license)

## 项目亮点

- `桌面提醒工具`：适合日常轻量使用，不追求复杂流程
- `飞行动画提醒`：提醒不再只是弹窗，而是更有存在感的动态表现
- `高自定义`：支持飞机、尾焰、文案框、图片、音频等多种配置
- `桌面端体验优化`：支持开机启动、本地持久化、紧急停止、静音等能力

## 界面预览

后续建议在这里补充截图，仓库首页展示效果会更完整。

### 建议展示的截图

- 首页主界面
- 飞行设置展开状态
- 新建任务弹窗
- 自定义音频与试听区域

### 截图占位示例

```md
![主界面截图](./docs/screenshots/home.png)
![飞行设置截图](./docs/screenshots/flight-settings.png)
![新建任务截图](./docs/screenshots/task-modal.png)
![自定义音频截图](./docs/screenshots/custom-audio.png)
```

## 功能概览

### 任务提醒

- 支持定时提醒
- 支持倒计时提醒
- 支持节日提醒
- 支持纪念日提醒
- 支持任务启用、停用、编辑、删除
- 支持倒计时的开始、暂停、停止

### 飞行表现

- 支持飞行速度配置
- 支持飞行高度配置
- 支持多种飞行节奏效果
- 支持多种飞机样式
- 支持多种尾焰样式
- 支持多种文案框样式
- 支持文案框位置设置

### 自定义能力

- 支持自定义飞行图片
- 支持普通图片和 GIF 动图
- 支持自定义提示音
- 支持显示已选音频文件名
- 支持 `试听 / 结束试听`
- 勾选后飞行时优先播放自定义音频

### 桌面端体验

- 支持静音
- 支持紧急停止
- 支持开机启动
- 支持本地持久化保存
- 优化了飞行时对输入操作的干扰

## 技术栈

- `Tauri 2`
- `Vite`
- `Vanilla JavaScript`
- `@tauri-apps/plugin-store`
- `@tauri-apps/plugin-autostart`
- `@tauri-apps/plugin-global-shortcut`
- `@tauri-apps/plugin-deep-link`
- `@tauri-apps/plugin-notification`
- `@tauri-apps/plugin-log`

### 平台支持

- **macOS** (Apple Silicon) — 主要平台，全部能力（含 `macos-private-api` 透明飞行窗口）
- **Windows** (x64) — 通过 NSIS 安装包分发
- **Linux** (Ubuntu 24.04) — 通过 AppImage 和 DEB 分发
- 需要 Linux 端运行，请先安装：`libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev librsvg2-dev patchelf`

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动前端开发环境

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:5173
```

### 启动桌面应用

```bash
npm run tauri dev
```

### 构建前端资源

```bash
npm run build
```

### 构建桌面安装包

```bash
npm run tauri build
```

打包前请确保本地已经安装好 Tauri 所需的系统依赖环境。

## 使用说明

### 1. 创建提醒任务

当前支持四类提醒：

- 定时提醒
- 倒计时提醒
- 节日提醒
- 纪念日提醒

### 2. 配置飞行效果

在底部的“飞行外观与声音”区域中，可以统一调整提醒的视觉和声音风格，包括：

- 飞行速度
- 飞行高度
- 飞行效果
- 飞机样式
- 尾焰样式
- 文案框样式
- 文案框位置
- 提示音音色
- 提示音播放方式
- 自定义图片
- 自定义音频

### 3. 使用自定义音频

上传音频后，界面会显示：

- 当前音频文件名
- `试听` 按钮
- 试听中切换为 `结束试听`

建议优先使用以下音频格式：

- `mp3`
- `wav`
- `ogg`

## 项目结构

```text
guguFly/
├── index.html              # 主界面结构
├── src/
│   ├── main.js             # 主界面逻辑、任务管理、飞行配置、音频逻辑
│   ├── flight.js           # 飞行动画窗口逻辑
│   ├── style.css           # 主界面样式
│   ├── storage.js          # 本地存储封装
│   ├── timer.js            # 计时器能力
│   └── quotes.js           # 提醒文案数据
├── src-tauri/
│   ├── tauri.conf.json     # Tauri 配置
│   └── src/
│       └── lib.rs          # Rust 侧入口
└── dist/                   # 前端构建产物
```

## 当前进展

### 已完成

- 主界面多轮布局优化
- 提醒列表可视空间优化
- 飞行设置抽屉化
- 多种飞行效果与样式扩展
- 自定义图片与 GIF 支持
- 自定义音频文件名展示
- `试听 / 结束试听` 交互
- 飞行时优先播放自定义音频
- 倒计时开始、暂停、停止逻辑完善
- 开机启动能力接入

### 计划继续完善

- 更完整的设置页
- 更多飞行动画模板
- 更多内置提示音
- 任务导入导出
- 多语言支持
- 系统通知联动
- 截图与演示资源补充

## 适用场景

- 日常定时提醒
- 番茄钟 / 倒计时提醒
- 周期性轻提醒
- 节日、纪念日提示
- 想要更有趣一点的桌面提醒体验

## License

本项目当前使用 [MIT License](./LICENSE)。
