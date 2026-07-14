# 参与贡献

感谢你对「破壁视界」感兴趣！无论是提交 Bug 报告、建议新功能，还是直接提交代码，都非常欢迎。

## 🐛 报告 Bug

提交 Bug 前请先在 [Issues](https://github.com/FishHighWJ/PoBi/issues) 搜索是否已被报告。

新建 Issue 时请使用 **Bug 报告模板**，并尽量提供：

- 操作系统版本（如 Windows 11 23H2）
- 「破壁视界」版本号（设置页底部可见）
- 复现步骤
- 预期行为 vs 实际行为
- 控制台报错截图（如可见）

> ⚠️ 提交前请确认已脱敏，**不要泄露你的 API Key**。

## 💡 建议新功能

直接新建 Issue 选择「功能建议」模板，说明：
- 你想解决什么问题
- 期望的交互方式
- 是否愿意为此提交 PR

## 🔧 提交 Pull Request

1. Fork 本仓库
2. 基于最新 `main` 创建特性分支（`git checkout -b feat/your-feature`）
3. 做最小化改动，一个 PR 只解决一件事
4. 代码风格：
   - JavaScript 使用 2 空格缩进
   - HTML / CSS 保持与现有页面一致的设计系统
   - 不引入构建工具，保持纯原生技术栈
5. 提交前请在本地充分自测：
   - `cd src && npm install && npm start` 能正常启动
   - 涉及 AI 功能的改动请测试 DeepSeek 与 OpenAI 兼容端点
6. PR 标题请用规范前缀：`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`
7. 描述清楚改动动机与影响范围

## 📂 代码组织约定

- 主进程逻辑放 `src/main.js`
- IPC 桥接放 `src/preload.js`
- 渲染进程共享逻辑放 `src/utils/shared.js`
- 新页面放 `src/pages/` 下，并在 `main.js` 的 `PANEL_PAGES` 注册
- 视觉规范统一参考 `src/utils/design-system.css`

## 📝 Commit 规范

```
<type>: <简短描述>

<可选正文说明动机或影响>
```

`type` 可选：`feat` `fix` `docs` `style` `refactor` `perf` `chore`

## 🤝 行为准则

请保持友善、尊重。技术分歧就事论事，不针对个人。

再次感谢你的贡献！
