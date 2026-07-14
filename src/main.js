const { app, BrowserWindow, ipcMain, screen, session, Tray, Menu, globalShortcut, nativeImage, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const os = require('os');

// ── 注册自定义安全协议（使 SpeechRecognition 等 API 可用）────────
// ── 启用 Web Speech API + 设备端语音识别（离线可用） ────────
app.commandLine.appendSwitch("enable-features", "WebSpeech,OnDeviceSpeechRecognition");
app.commandLine.appendSwitch("disable-features", "");

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);



// ── 面板名 → HTML 文件映射 ──────────────────────────────────────────
const PANEL_PAGES = {
  '记录面板': '记录面板.html',
  '设置页': '设置页.html',
  '计时器': '计时器.html',
  '破壁结果': '破壁结果.html',
  '灵感火花弹窗': '灵感火花弹窗.html',
  '日报': '日报.html',
  '周报': '周报.html',
};

// ── 窗口引用 ────────────────────────────────────────────────────────
let floatingWindow = null;
let sidePanel = null;
let tray = null;

// ── 悬浮窗尺寸 ──────────────────────────────────────────────────────
const FLOAT_W = 460;
const FLOAT_H = 56;
const FLOAT_H_EXPANDED = 220;

// ── 配置文件路径 ────────────────────────────────────────────────────
function getConfigPath() {
  return path.join(app.getPath('userData'), 'window-config.json');
}

function loadConfig() {
  try {
    const data = fs.readFileSync(getConfigPath(), 'utf-8');
    return JSON.parse(data);
  } catch { return {}; }
}

function saveConfig(data) {
  try {
    const existing = loadConfig();
    Object.assign(existing, data);
    fs.writeFileSync(getConfigPath(), JSON.stringify(existing, null, 2), 'utf-8');
  } catch (e) { console.warn('保存配置失败:', e.message); }
}

// ── 获取主屏 ────────────────────────────────────────────────────────
function getPrimaryDisplay() {
  return screen.getPrimaryDisplay();
}

function getDefaultFloatPosition() {
  const display = getPrimaryDisplay();
  const { x, y, width } = display.workArea;
  return {
    x: Math.round(x + (width - FLOAT_W) / 2),
    y: y + 8,
  };
}

// ── 创建系统托盘 ────────────────────────────────────────────────────
function createTray() {
  // 生成 16x16 托盘图标（用 nativeImage 创建纯色圆点）
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const px = i % size;
    const py = Math.floor(i / size);
    const cx = size / 2, cy = size / 2;
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    if (dist < 5.5) {
      canvas[i * 4] = 124;     // R
      canvas[i * 4 + 1] = 92;  // G
      canvas[i * 4 + 2] = 252; // B
      canvas[i * 4 + 3] = 255; // A
    } else {
      canvas[i * 4 + 3] = 0;   // transparent
    }
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });

  tray = new Tray(icon);
  tray.setToolTip('破壁视界');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示悬浮窗', click: () => { showFloatingWindow(); } },
    { label: '隐藏悬浮窗', click: () => { hideFloatingWindow(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => { showFloatingWindow(); });
}

function showFloatingWindow() {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.show();
    floatingWindow.focus();
  } else {
    createFloatingWindow();
  }
}

function hideFloatingWindow() {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.hide();
  }
}

// ── AI API 代理（通过主进程调用，绕过 CORS）───────────────────────
const https = require('https');
const url = require('url');

async function callAIApi(prompt, systemPrompt, config) {
  const apiUrl = config?.apiUrl || 'https://api.deepseek.com/v1';
  const apiKey = config?.apiKey || '';
  const modelName = config?.modelName || 'deepseek-chat';

  if (!apiKey) {
    throw new Error('请先在设置中配置 API Key');
  }

  const fullUrl = `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  const parsedUrl = url.parse(fullUrl);
  
  const body = JSON.stringify({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt || '你是一个贴心温暖的思维破壁小助手，说话语气委婉温柔，像好朋友一样真诚地为用户着想。请针对用户提供的内容，深入分析并提供有价值的帮助。回答要求：1) 语气亲切柔和，避免生硬说教，多用鼓励和支持的话语；2) 帮助用户从不同角度思考问题，打破思维局限；3) 提供具体可执行的建议和解决方案，给用户明确的行动方向；4) 语言通俗易懂，用日常聊天的口吻表达；5) 内容要有深度，能真正帮助用户开拓思路、解决问题；6) 不要使用任何特殊符号（如星号、括号、序号等）。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('API 请求超时（30秒），请检查网络或 API 地址'));
    }, 30000);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      clearTimeout(timeout);
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API 请求失败: ${res.statusCode} — ${data}`));
          return;
        }
        try {
          const result = JSON.parse(data);
          if (!result.choices || result.choices.length === 0) {
            reject(new Error('API 返回了空的回复，请检查模型名称是否正确或尝试其他模型'));
            return;
          }
          let content = result.choices[0].message.content;
          content = content.replace(/\*/g, '').replace(/【/g, '').replace(/】/g, '').replace(/「/g, '').replace(/」/g, '').replace(/《/g, '').replace(/》/g, '').replace(/【/g, '').replace(/】/g, '').trim();
          resolve(content);
        } catch (e) {
          reject(new Error('解析 API 响应失败: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      clearTimeout(timeout);
      reject(new Error('网络请求失败: ' + e.message));
    });

    req.write(body);
    req.end();
  });
}

// ── 注册全局快捷键 ──────────────────────────────────────────────────
function registerShortcuts() {
  globalShortcut.register('Alt+Space', () => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      if (floatingWindow.isVisible()) {
        floatingWindow.hide();
      } else {
        floatingWindow.show();
        floatingWindow.focus();
      }
    } else {
      createFloatingWindow();
    }
  });
}

// ── 创建悬浮窗 ──────────────────────────────────────────────────────
function createFloatingWindow() {
  const saved = loadConfig();
  const defaultPos = getDefaultFloatPosition();

  floatingWindow = new BrowserWindow({
    width: FLOAT_W,
    height: FLOAT_H,
    x: saved.floatX !== undefined ? saved.floatX : defaultPos.x,
    y: saved.floatY !== undefined ? saved.floatY : defaultPos.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
          },
  });

  floatingWindow.loadURL('app://pages/悬浮窗.html');
  floatingWindow.setVisibleOnAllWorkspaces(true);
  floatingWindow.setAlwaysOnTop(true, 'normal');

  // 监听窗口移动 → 记忆位置
  let moveTimer = null;
  floatingWindow.on('move', () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      if (floatingWindow && !floatingWindow.isDestroyed()) {
        const [fx, fy] = floatingWindow.getPosition();
        const [fw] = floatingWindow.getSize();
        saveConfig({ floatX: fx, floatY: fy, floatW: fw });
      }
    }, 500);
  });

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
}

// ── 创建/更新侧面板 ─────────────────────────────────────────────────
function showSidePanel(pageName) {
  const fileName = PANEL_PAGES[pageName];
  if (!fileName) { console.warn('未知面板:', pageName); return; }

  const display = getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const panelW = Math.floor(width / 2);
  const panelH = height - 60;
  const panelX = x + width - panelW;
  const panelY = y + 30;

  if (sidePanel) {
    sidePanel.loadURL('app://pages/' + fileName);
    sidePanel.setSize(panelW, panelH);
    sidePanel.setPosition(panelX, panelY);
    if (!sidePanel.isVisible()) { sidePanel.show(); sidePanel.focus(); }
    return;
  }

  sidePanel = new BrowserWindow({
    width: panelW,
    height: panelH,
    x: panelX,
    y: panelY,
    minWidth: 340,
    minHeight: 400,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    show: false,
    hasShadow: true,
    backgroundColor: '#F0F2F5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
          },
  });

  sidePanel.loadURL('app://pages/' + fileName);

  sidePanel.once('ready-to-show', () => { sidePanel.show(); sidePanel.focus(); });
  sidePanel.on('closed', () => { sidePanel = null; });
}

// ── 隐藏/关闭侧面板 ─────────────────────────────────────────────────
function hideSidePanel() {
  if (sidePanel && !sidePanel.isDestroyed()) { sidePanel.hide(); }
}
function closeSidePanel() {
  if (sidePanel && !sidePanel.isDestroyed()) { sidePanel.close(); sidePanel = null; }
}

// ── 动态调整悬浮窗大小 ──────────────────────────────────────────────
function resizeFloating(width, height) {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  const w = width || FLOAT_W;
  const h = height || FLOAT_H;
  const display = getPrimaryDisplay();
  const { x, width: screenW } = display.workArea;
  const currentPos = floatingWindow.getPosition();
  const newX = Math.round(x + (screenW - w) / 2);
  floatingWindow.setSize(w, h);
  floatingWindow.setPosition(newX, currentPos[1]);
  saveConfig({ floatX: newX, floatW: w });
}

// ── IPC 处理 ────────────────────────────────────────────────────────
function registerIpc() {
  ipcMain.on('open-panel', (_event, pageName) => { showSidePanel(pageName); });
  ipcMain.on('close-panel', () => { closeSidePanel(); });

  ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win === floatingWindow) { hideFloatingWindow(); }
      else { win.close(); }
    }
  });

  ipcMain.on('expand-float', () => { resizeFloating(FLOAT_W, FLOAT_H_EXPANDED); });
  ipcMain.on('collapse-float', () => { resizeFloating(FLOAT_W, FLOAT_H); });

  // 接收渲染进程的导出数据 → 弹出保存对话框并写入文件
  ipcMain.on('save-export-file', async (event, jsonData) => {
    const { filePath } = await dialog.showSaveDialog({
      title: '导出数据',
      defaultPath: '破壁视界-数据备份.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (filePath) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
        if (!event.sender.isDestroyed()) {
          event.sender.send('export-result', { success: true, path: filePath });
        }
      } catch (e) {
        if (!event.sender.isDestroyed()) {
          event.sender.send('export-result', { success: false, error: e.message });
        }
      }
    } else {
      if (!event.sender.isDestroyed()) {
        event.sender.send('export-result', { success: false, error: 'cancelled' });
      }
    }
  });

  // 接收渲染进程的语音音频数据 → 保存到用户目录（避免 localStorage 配额溢出）
  ipcMain.on('save-voice-file', async (event, base64Data) => {
    try {
      const userDataPath = app.getPath('userData');
      const voiceDir = path.join(userDataPath, 'voice_records');
      if (!fs.existsSync(voiceDir)) {
        fs.mkdirSync(voiceDir, { recursive: true });
      }
      const fileName = `voice_${Date.now()}.webm`;
      const filePath = path.join(voiceDir, fileName);
      const buffer = Buffer.from(base64Data.split(',')[1] || base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
      // 返回 app:// URL，渲染进程可直接用于 <audio> 标签
      const appUrl = `app://voice_records/${fileName}`;
      if (!event.sender.isDestroyed()) {
        event.sender.send('voice-file-saved', { success: true, path: filePath, url: appUrl });
      }
    } catch (e) {
      if (!event.sender.isDestroyed()) {
        event.sender.send('voice-file-saved', { success: false, error: e.message });
      }
    }
  });

  // AI API 代理调用（绕过 CORS）
  ipcMain.handle('call-ai-api', async (_event, { prompt, systemPrompt, config }) => {
    try {
      const result = await callAIApi(prompt, systemPrompt, config);
      return { success: true, content: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 语音转文字 — 调用 Windows 系统语音识别（中文）
  ipcMain.handle('transcribe-wav', async (_event, wavBase64) => {
    const tempDir = os.tmpdir();
    const ts = Date.now();
    const wavPath = path.join(tempDir, 'pobi_stt_' + ts + '.wav');
    const txtPath = path.join(tempDir, 'pobi_stt_' + ts + '.txt');
    try {
      const buffer = Buffer.from(wavBase64, 'base64');
      fs.writeFileSync(wavPath, buffer);

      // 输出到文件避免编码问题；指定中文识别
      const psScript =
        'chcp 65001 > $null;' +
        '[Console]::OutputEncoding = [Text.Encoding]::UTF8;' +
        'Add-Type -AssemblyName System.Speech;' +
        '$culture = [Globalization.CultureInfo]::new("zh-CN");' +
        '$r = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture);' +
        "$r.SetInputToWaveFile('" + wavPath.replace(/\\/g, '\\\\') + "');" +
        '$d = New-Object System.Speech.Recognition.DictationGrammar;' +
        '$r.LoadGrammar($d);' +
        'try { $result = $r.Recognize() } catch { $result = $null };' +
        "if ($result) { [IO.File]::WriteAllText('" + txtPath.replace(/\\/g, '\\\\') + "', $result.Text, [Text.Encoding]::UTF8) }" +
        " else { [IO.File]::WriteAllText('" + txtPath.replace(/\\/g, '\\\\') + "', '', [Text.Encoding]::UTF8) }";

      return new Promise((resolve) => {
        execFile('powershell.exe', ['-NoProfile', '-Command', psScript], { timeout: 30000 }, (err, _stdout, stderr) => {
          try { fs.unlinkSync(wavPath); } catch (e) {}
          if (err) {
            try { fs.unlinkSync(txtPath); } catch (e) {}
            console.error('[STT] PowerShell 失败:', stderr || err.message);
            resolve({ success: false, error: (stderr || err.message).slice(0, 200) });
          } else {
            try {
              const text = fs.readFileSync(txtPath, 'utf-8').trim();
              fs.unlinkSync(txtPath);
              console.log('[STT] 识别结果:', text.length + '字');
              resolve({ success: true, text: text });
            } catch (e2) {
              resolve({ success: false, error: '读取结果失败' });
            }
          }
        });
      });
    } catch (e) {
      try { fs.unlinkSync(wavPath); } catch (e2) {}
      try { fs.unlinkSync(txtPath); } catch (e2) {}
      return { success: false, error: e.message };
    }
  });

  // 语音转文字 — Whisper 兼容 API
  ipcMain.handle('transcribe-whisper', async (_event, { wavBase64, sttUrl, sttKey, sttModel }) => {
    const apiUrl = sttUrl || '';
    const apiKey = sttKey || '';
    const model = sttModel || 'whisper-1';

    if (!apiUrl || !apiKey) {
      return { success: false, error: '请先在设置中配置语音识别 API' };
    }

    // Build multipart/form-data manually
    const boundary = '----PoBiBoundary' + Date.now();
    const wavBuffer = Buffer.from(wavBase64, 'base64');
    const header = '--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n';
    const middle = '\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="model"\r\n\r\n' + model;
    const middle2 = '\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="language"\r\n\r\nzh';
    const footer = '\r\n--' + boundary + '--\r\n';

    const body = Buffer.concat([
      Buffer.from(header, 'utf-8'), wavBuffer,
      Buffer.from(middle, 'utf-8'),
      Buffer.from(middle2, 'utf-8'),
      Buffer.from(footer, 'utf-8')
    ]);

    const parsedUrl = url.parse(apiUrl);

    return new Promise((resolve) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': body.length,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.text) {
              resolve({ success: true, text: result.text.trim() });
            } else if (result.error) {
              resolve({ success: false, error: result.error.message || JSON.stringify(result.error) });
            } else {
              resolve({ success: false, error: '返回格式异常: ' + data.slice(0, 100) });
            }
          } catch (e) {
            resolve({ success: false, error: '解析失败: ' + data.slice(0, 100) });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: '网络错误: ' + e.message });
      });

      req.setTimeout(30000, () => {
        req.destroy();
        resolve({ success: false, error: '请求超时' });
      });

      req.write(body);
      req.end();
    });
  });

  }

// ── 应用启动 ────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // ── 自动批准麦克风权限（合并为一个，避免覆盖冲突） ──────────
  session.defaultSession.setPermissionRequestHandler(function(_webContents, permission, callback) {
    // getUserMedia 在不同 Electron 版本可能发 media / audio / microphone
    var allowed = permission === 'media' || permission === 'audio' || permission === 'microphone';
    callback(allowed);
  });
  session.defaultSession.setPermissionCheckHandler(function(_webContents, permission) {
    return permission === 'media' || permission === 'audio' || permission === 'microphone';
  });

  // ── 注册自定义文件协议处理 ─────────────────────────────────────
  protocol.handle('app', (request) => {
    // 移除协议前缀，统一处理 app:// 和 app:/// 两种格式
    let filePath = request.url.replace(/^app:\/\/\/?/, '');
    // 去掉可能的查询参数和 hash
    filePath = filePath.split('?')[0].split('#')[0];
    filePath = path.normalize(decodeURIComponent(filePath));
    if (filePath === '' || filePath === '.' || filePath === '/') {
      filePath = 'pages/悬浮窗.html';
    }
    // 语音文件从 userData 目录加载，其他从 app 目录加载
    let fullPath;
    if (filePath.startsWith('voice_records' + path.sep) || filePath.startsWith('/voice_records' + path.sep)) {
      fullPath = path.join(app.getPath('userData'), filePath);
    } else {
      fullPath = path.join(__dirname, filePath);
      // 如果文件不存在，尝试备用路径（处理 pages 作为 hostname 导致的路径错误）
      if (!fs.existsSync(fullPath) && filePath.startsWith('pages' + path.sep)) {
        const altPath = path.join(__dirname, filePath.slice(('pages' + path.sep).length));
        if (fs.existsSync(altPath)) { fullPath = altPath; }
      }
    }
    // 使用 fs.readFileSync 读取文件（避免 net.fetch 处理中文路径问题）
    try {
      const data = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js':   'application/javascript; charset=utf-8',
        '.css':  'text/css; charset=utf-8',
        '.png':  'image/png',
        '.jpg':  'image/jpeg',
        '.svg':  'image/svg+xml',
        '.json': 'application/json',
        '.webm': 'audio/webm',
        '.ogg':  'audio/ogg',
        '.wav':  'audio/wav',
        '.mp3':  'audio/mpeg',
      };
      return new Response(data, {
        status: 200,
        headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' },
      });
    } catch (e) {
      console.error('[协议] 文件未找到:', fullPath, e.message);
      return new Response('File not found: ' + filePath, { status: 404 });
    }
  });

  registerIpc();
  createFloatingWindow();
  createTray();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) { createFloatingWindow(); }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});



