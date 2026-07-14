# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号采用 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中
- 补充应用截图到 README
- 完善 Mac/Linux 兼容性评估

## [1.0.0] - 2026-07-15

### ✨ 新增
- 悬浮窗常驻桌面顶部，位置自动记忆
- `Alt + Space` 全局快捷键呼出/隐藏悬浮窗
- 灵感记录面板，支持分类管理
- **破壁分析**：基于 AI（DeepSeek/OpenAI 兼容）从多角度切入，打破思维局限
- 语音输入，支持两种方案：
  - Whisper 兼容 API（在线）
  - Windows System.Speech 本地离线识别
- 亮色 / 暗色主题切换
- 灵感火花：随机回顾历史灵感
- 日报 / 周报自动统计
- 数据导出为 JSON 备份
- 系统托盘菜单
- AI API 连接测试功能

### 🛠️ 技术栈
- Electron 33
- 原生 HTML / CSS / JavaScript（无构建步骤）
- DeepSeek / OpenAI 兼容 API

### 🔒 隐私
- 全部数据本地存储，不上传服务器
- AI 仅在主动触发破壁分析时接收对应文本

## 版本号说明

- `MAJOR`：不兼容的 API / 数据结构变更
- `MINOR`：向下兼容的功能新增
- `PATCH`：向下兼容的缺陷修复

[Unreleased]: https://github.com/FishHighWJ/PoBi/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/FishHighWJ/PoBi/releases/tag/v1.0.0
