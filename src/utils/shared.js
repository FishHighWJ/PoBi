/* ============================================================
   破壁视界 — 共享工具模块
   所有页面通过 <script src="../utils/shared.js"></script> 引用
   ============================================================ */

// ── 安全的 API 访问层 ──────────────────────────────────────
// 如果 electronAPI 未加载（preload 失败），所有调用静默降级
window._safeAPI = function() {
  if (window._cachedAPI === undefined) {
    window._cachedAPI = (typeof window.electronAPI !== 'undefined' && window.electronAPI) || null;
    if (!window._cachedAPI) {
      console.error('[破壁视界] ⚠️ electronAPI 未加载！preload 脚本可能未执行。所有面板功能将不可用。');
    }
  }
  return window._cachedAPI || {
    openPanel: function(n) { console.warn('[降级] openPanel(' + n + ') 不可用'); },
    closePanel: function() { console.warn('[降级] closePanel 不可用'); },
    closeWindow: function() { console.warn('[降级] closeWindow 不可用'); window.close(); },
    expandFloat: function() {},
    collapseFloat: function() {},
    saveExportFile: function(d) { console.warn('[降级] saveExportFile 不可用'); },
    onExportResult: function(f) {},
    onExportResultOnce: function(f) {},
    saveVoiceFile: function(d) { console.warn('[降级] saveVoiceFile 不可用'); },
    onVoiceFileSaved: function(f) {},
  };
};

// ── 安全 JSON 解析（防损坏数据崩溃） ──────────────────────────
window.safeJSON = function(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); }
  catch (_) { return fallback; }
};

// XSS 防护：HTML 转义
window.escapeHtml = function(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
};

// ── 格式化时间戳 ──────────────────────────────────────────────
window.PoBiUtils = {
  formatTime(isoStr) {
    if (!isoStr) return '刚刚';
    const now = Date.now();
    const t = new Date(isoStr).getTime();
    if (isNaN(t)) return '刚刚';
    const diff = now - t;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    const d = new Date(t);
    return `${d.getMonth()+1}月${d.getDate()}日`;
  },

  nowISO() {
    return new Date().toISOString();
  },

  // ── localStorage 数据操作 ───────────────────────────────────
  getRecords() {
    try { return JSON.parse(localStorage.getItem('pobi_records') || '[]'); }
    catch (_) { return []; }
  },

  saveRecords(records) {
    localStorage.setItem('pobi_records', JSON.stringify(records));
  },

  addRecord(content, category) {
    // 简单同步锁：防止快速连续调用时并发写入覆盖数据
    if (this._saving) {
      setTimeout(() => this.addRecord(content, category), 50);
      return null;
    }
    this._saving = true;
    try {
      const records = this.getRecords();
      const newId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
      records.unshift({
        id: newId,
        content: content,
        category: category || '全部',
        createdAt: this.nowISO(),
      });
      this.saveRecords(records);
      return newId;
    } finally {
      this._saving = false;
    }
  },

  getAIConfig() {
    return {
      apiUrl: localStorage.getItem('pobi_apiUrl') || 'https://api.deepseek.com/v1',
      apiKey: localStorage.getItem('pobi_apiKey') || '',
      modelName: localStorage.getItem('pobi_modelName') || 'deepseek-chat',
      sttUrl: localStorage.getItem('pobi_sttUrl') || '',
      sttKey: localStorage.getItem('pobi_sttKey') || '',
      sttModel: localStorage.getItem('pobi_sttModel') || 'whisper-1',
    };
  },

  saveAIConfig(config) {
    if (config.apiUrl) localStorage.setItem('pobi_apiUrl', config.apiUrl);
    if (config.apiKey !== undefined) localStorage.setItem('pobi_apiKey', config.apiKey);
    if (config.modelName) localStorage.setItem('pobi_modelName', config.modelName);
    if (config.sttUrl !== undefined) localStorage.setItem('pobi_sttUrl', config.sttUrl);
    if (config.sttKey !== undefined) localStorage.setItem('pobi_sttKey', config.sttKey);
    if (config.sttModel) localStorage.setItem('pobi_sttModel', config.sttModel);
  },

  // ── AI API 调用 ────────────────────────────────────────────
  async callAI(prompt, systemPrompt) {
    const config = this.getAIConfig();
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key');

    if (window.electronAPI && window.electronAPI.callAIApi) {
      const result = await window.electronAPI.callAIApi(prompt, systemPrompt, config);
      if (result.success) return result.content;
      throw new Error(result.error);
    }
    throw new Error('API 调用不可用：electronAPI 未加载');
  },

  getTodayRecords() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    return this.getRecords().filter(r => r.createdAt >= todayStart && r.createdAt < tomorrowStart);
  },

  getWeekRecords() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const mondayStart = monday.toISOString();
    const nextMonday = new Date(monday.getTime() + 7 * 86400000).toISOString();
    return this.getRecords().filter(r => r.createdAt >= mondayStart && r.createdAt < nextMonday);
  },

  // ── Toast 提示 ─────────────────────────────────────────────
  showToast(msg, duration) {
    let toast = document.getElementById('pobi-global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pobi-global-toast';
      toast.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:#1A1D27;color:#fff;font-size:13px;padding:8px 20px;border-radius:8px;z-index:99999;transition:all 0.3s ease;opacity:0;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, duration || 2000);
  },
};

// ── ClickSpark 点击火花（带可见性暂停） ─────────────────────────
window.ClickSpark = class ClickSpark {
  constructor(options = {}) {
    this.sparkColor  = options.sparkColor  || '#1A1D27';
    this.sparkSize   = options.sparkSize   || 10;
    this.sparkRadius = options.sparkRadius || 15;
    this.sparkCount  = options.sparkCount  || 8;
    this.duration    = options.duration    || 400;
    this.easing      = options.easing      || 'ease-out';
    this.extraScale  = options.extraScale  || 1.0;

    this.canvas = document.getElementById('spark-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.sparks = [];
    this._running = true;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    document.addEventListener('click', (e) => this.handleClick(e));
    document.addEventListener('visibilitychange', () => {
      this._running = !document.hidden;
      if (this._running) this.animate();
    });
    this.animate();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  easeFunc(t) {
    switch (this.easing) {
      case 'linear':      return t;
      case 'ease-in':     return t * t;
      case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:            return t * (2 - t);
    }
  }

  handleClick(e) {
    const now = performance.now();
    for (let i = 0; i < this.sparkCount; i++) {
      this.sparks.push({
        x: e.clientX, y: e.clientY,
        angle: (2 * Math.PI * i) / this.sparkCount,
        startTime: now,
      });
    }
  }

  animate() {
    const draw = (timestamp) => {
      if (!this._running) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.sparks = this.sparks.filter(spark => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= this.duration) return false;
        const progress = elapsed / this.duration;
        const eased = this.easeFunc(progress);
        const distance = eased * this.sparkRadius * this.extraScale;
        const lineLength = this.sparkSize * (1 - eased);
        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);
        this.ctx.strokeStyle = this.sparkColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        return true;
      });
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }
};

// ── 模态弹窗拖拽（带边界检测） ────────────────────────────────
// ── 深色模式 ──────────────────────────────────────────────
window.ThemeManager = {
  init() {
    const saved = localStorage.getItem('pobi_theme') || 'light';
    this.set(saved);
  },
  get() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  },
  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pobi_theme', theme);
  },
  toggle() {
    const cur = this.get();
    this.set(cur === 'dark' ? 'light' : 'dark');
    return this.get();
  },
};

// ── 弹性动效辅助 ──────────────────────────────────────────
window.AnimUtils = {
  // 元素弹性入场
  fadeInUp(el, delay = 0) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = 'none';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transitionDelay = delay + 'ms';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
  },

  // 弹性缩放
  scaleIn(el, delay = 0) {
    el.style.opacity = '0';
    el.style.transform = 'scale(0.92)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transitionDelay = delay + 'ms';
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
    });
  },

  // Stagger 入场
  staggerIn(container, delay = 60) {
    const items = container.children;
    Array.from(items).forEach((el, i) => {
      this.fadeInUp(el, i * delay);
    });
  },
};

window.makeModalDraggable = function(modalSelector, headerSelector) {
  const dlg = typeof modalSelector === 'string' ? document.querySelector(modalSelector) : modalSelector;
  const hdr = typeof headerSelector === 'string' ? document.querySelector(headerSelector) : headerSelector;
  if (!dlg || !hdr) return;
  dlg.style.position = 'fixed';
  let dragging = false, sx, sy, sl, st;
  hdr.style.cursor = 'grab';
  hdr.addEventListener('mousedown', (e) => {
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    const r = dlg.getBoundingClientRect();
    sl = r.left;
    st = r.top;
    dlg.style.transition = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    let newLeft = sl + e.clientX - sx;
    let newTop  = st + e.clientY - sy;
    // 边界检测
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth  - dlg.offsetWidth));
    newTop  = Math.max(0, Math.min(newTop,  window.innerHeight - dlg.offsetHeight));
    dlg.style.left = newLeft + 'px';
    dlg.style.top  = newTop + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      dlg.style.transition = '';
    }
  });
};


// ============================================================
// 全局异常捕获
// ============================================================
(function() {
  // 显示友好的错误提示（居中显示，任何窗口尺寸都可见）
  function showErrorToast(msg) {
    var toast = document.getElementById('pobi-error-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pobi-error-toast';
      toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
        'background:#E74C3C;color:#fff;font-size:13px;padding:10px 20px;border-radius:10px;' +
        'z-index:999999;opacity:0;transition:opacity 0.3s ease;pointer-events:none;' +
        'max-width:80%;text-align:center;box-shadow:0 2px 12px rgba(231,76,60,0.3);';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(function() {
      toast.style.opacity = '0';
    }, 5000);
  }

  // 全局错误捕获 — 显示实际错误信息，帮助调试
  window.onerror = function(msg, url, line, col, error) {
    var detail = (msg && String(msg).slice(0, 80)) || '未知错误';
    console.error('[破壁视界] 未捕获错误:', msg, 'at', line + ':' + col);
    showErrorToast('⚠️ 错误: ' + detail);
    return true;
  };

  // 未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', function(event) {
    console.error('[破壁视界] 未处理的 Promise 拒绝:', event.reason);
    showErrorToast('操作失败，请稍后重试');
  });

  console.log('[破壁视界] 错误边界已启动');

  // API 可用性检查 — 如果 electronAPI 未加载，显示明确错误
  if (typeof window.electronAPI === 'undefined') {
    console.error('[破壁视界] electronAPI 未加载！preload 脚本可能失败');
    showErrorToast('API 桥接未加载，请重启应用');
  }
})();
