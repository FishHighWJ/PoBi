const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** 打开侧面板并加载指定页面 */
  openPanel: (name) => ipcRenderer.send('open-panel', name),

  /** 关闭侧面板 */
  closePanel: () => ipcRenderer.send('close-panel'),

  /** 关闭当前窗口 */
  closeWindow: () => ipcRenderer.send('close-window'),

  /** 悬浮窗展开（输入框聚焦时用） */
  expandFloat: () => ipcRenderer.send('expand-float'),

  /** 悬浮窗收起 */
  collapseFloat: () => ipcRenderer.send('collapse-float'),

  /** 导出数据：发送 JSON 到主进程保存文件 */
  saveExportFile: (data) => ipcRenderer.send('save-export-file', data),

  /** 导出结果回调 */
  onExportResult: (callback) => {
    ipcRenderer.on('export-result', (_event, result) => callback(result));
  },
  /** 导出结果回调（一次性，自动清理） */
  onExportResultOnce: (callback) => {
    ipcRenderer.once('export-result', (_event, result) => callback(result));
  },

  /** 保存语音文件到磁盘（返回文件路径） */
  saveVoiceFile: (base64Data) => ipcRenderer.send('save-voice-file', base64Data),

  /** 语音文件保存结果回调 */
  onVoiceFileSaved: (callback) => {
    ipcRenderer.once('voice-file-saved', (_event, result) => callback(result));
  },

  /** 调用 AI API（通过主进程代理，绕过 CORS） */
  callAIApi: (prompt, systemPrompt, config) => ipcRenderer.invoke('call-ai-api', { prompt, systemPrompt, config }),

  /** 语音转文字 — Windows 系统语音识别 */
  transcribeWav: (wavBase64) => ipcRenderer.invoke('transcribe-wav', wavBase64),

  /** 语音转文字 — Whisper 兼容 API */
  transcribeWhisper: (wavBase64, sttUrl, sttKey, sttModel) => ipcRenderer.invoke('transcribe-whisper', { wavBase64, sttUrl, sttKey, sttModel })
});
