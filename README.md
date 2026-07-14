# 破壁视界

> 打破信息茧房，拥抱多元视角

一款基于 Electron 的轻量桌面悬浮工具，以悬浮窗形式常驻桌面，无需安装，随时记录灵感并提供破壁功能。

## 项目结构

```
├── src/                     # Electron 应用源码
│   ├── main.js              # 主进程
│   ├── preload.js           # 预加载脚本
│   ├── package.json         # 项目配置
│   ├── pages/               # 页面
│   │   ├── 悬浮窗.html       # 悬浮主窗口
│   │   ├── 记录面板.html     # 灵感记录面板
│   │   ├── 设置页.html       # 设置页面
│   │   ├── 计时器.html       # 计时器
│   │   ├── 破壁结果.html     # 破壁结果展示
│   │   ├── 灵感火花弹窗.html  # 灵感回顾弹窗
│   │   ├── 日报.html         # 每日报告
│   │   └── 周报.html         # 每周报告
│   └── utils/               # 工具模块
│       ├── shared.js
│       └── design-system.css
├── demo.html                # 网页版独立 Demo
├── releases/                # 发布包
│   ├── 破壁视界-发布版.zip
│   └── 破壁视界-Demo.zip
├── README.md
├── .gitignore
└── .gitattributes
```

## 功能特性

- 🪟 **悬浮窗** — 常驻桌面顶部，随时调用
- 📝 **灵感记录** — 快速记录想法，支持分类管理
- 🎙️ **语音输入** — Whisper API 语音转文字
- 🌓 **暗色模式** — 亮色/暗色主题切换
- 📊 **每日/每周回顾** — 记录统计与回顾
- ✨ **灵感火花** — 随机回顾历史灵感

## 快速开始

### 开发运行

```bash
cd src
npm install
npm start
```

### 网页 Demo

直接在浏览器中打开 `demo.html` 即可体验。

### 发布版

下载 `releases/破壁视界-发布版.zip`，解压后双击 `破壁视界.exe` 运行。

## 技术栈

- **Electron** — 桌面应用框架
- **HTML / CSS / JavaScript** — 前端
- **Whisper API** — 语音识别
