"use strict";

const STORAGE_KEY_ENABLED = "auto-approve-enabled";
const STORAGE_KEY_DEBUG = "auto-approve-debug";
const PAGE_ID = "auto-approve";
const PAGE_TITLE = "Auto Approve";
const SCAN_INTERVAL_MS = 1200;
const SCAN_DEBOUNCE_MS = 120;
const CLICK_COOLDOWN_MS = 2500;
const ACTIVATE_COOLDOWN_MS = 4000;
const MAX_CONTEXT_LENGTH = 4000;
const PATCH_RETRY_DELAYS_MS = [0, 800, 2500, 5000, 9000];
const BACKGROUND_SCAN_INTERVAL_MS = 2500;
const APPROVAL_ATTEMPT_COOLDOWN_MS = 5000;
const MAX_OBJECT_SCAN_DEPTH = 6;
const MAX_OBJECT_SCAN_KEYS = 80;
const MAX_DISCOVERED_CONVERSATIONS = 200;
const STATE_KEY = "__codexppAutoApproveGlobalState";

const TEXT = {
  en: {
    pageTitle: "Auto Approve",
    sectionTitle: "Auto Approve",
    enableTitle: "Enable Auto Approve",
    enableDescription: "Automatically clicks approve/allow/continue buttons for command and MCP approval prompts.",
    debugTitle: "Debug Logging",
    debugDescription: "Write candidate click logs into Codex++ renderer logs.",
    approvedCountTitle: "Approved Count",
    approvedCountDescription: "How many approval prompts this tweak has auto-clicked since the current renderer session started.",
    backgroundCountTitle: "Background Count",
    backgroundCountDescription: "How many approval attempts were completed through manager or bridge scans instead of visible foreground buttons.",
    lastActionTitle: "Last Action",
    lastActionDescription: "Most recent approval action or current idle status.",
    riskTitle: "Risk",
    riskDescription: "This tweak intentionally approves almost any matching prompt. Keep it off when you want manual review.",
    approvesEverything: "Approves everything",
    waiting: "Waiting for approval prompts.",
    enabled: "Auto approve enabled.",
    disabled: "Auto approve disabled.",
    clicked: (label) => `Clicked "${label}"`,
    activated: (label) => `Activated "${label}"`,
    autoApproved: (label, source) => `Auto-approved ${label} (${source})`,
    request: "request",
  },
  zh: {
    pageTitle: "自动批准",
    sectionTitle: "自动批准",
    enableTitle: "启用自动批准",
    enableDescription: "自动点击命令和 MCP 批准提示中的批准、允许或继续按钮。",
    debugTitle: "调试日志",
    debugDescription: "将候选点击日志写入 Codex++ 渲染器日志。",
    approvedCountTitle: "批准次数",
    approvedCountDescription: "当前渲染器会话中此插件已自动点击的批准提示数量。",
    backgroundCountTitle: "后台次数",
    backgroundCountDescription: "通过管理器或桥接扫描完成的批准尝试数量，而不是可见的前台按钮。",
    lastActionTitle: "最近操作",
    lastActionDescription: "最近一次批准操作或当前空闲状态。",
    riskTitle: "风险",
    riskDescription: "此插件会有意批准几乎所有匹配的提示。需要手动审核时请关闭它。",
    approvesEverything: "批准所有匹配项",
    waiting: "正在等待批准提示。",
    enabled: "已启用自动批准。",
    disabled: "已停用自动批准。",
    clicked: (label) => `已点击“${label}”`,
    activated: (label) => `已激活“${label}”`,
    autoApproved: (label, source) => `已自动批准 ${label}（${source}）`,
    request: "请求",
  },
};

const STRONG_APPROVE_LABELS = [
  "approve",
  "allow",
  "allow computer use",
  "allow access",
  "accept",
  "run anyway",
  "always allow",
  "yes",
  "agree",
  "allow once",
  "approve once",
  "allow all",
  "trusted",
  "go ahead",
  "grant access",
  "grant",
  "允许",
  "批准",
  "允许使用计算机",
  "允许计算机使用",
  "允许访问",
  "接受",
  "仍要运行",
  "始终允许",
  "是",
  "同意",
  "允许一次",
  "批准一次",
  "允许运行一次",
  "允许并继续",
  "同意并继续",
  "全部允许",
  "信任",
  "授予访问权限",
  "授予",
];

const CONTEXTUAL_APPROVE_LABELS = [
  "continue",
  "proceed",
  "run",
  "confirm",
  "ok",
  "continue anyway",
  "execute",
  "resume",
  "continue execution",
  "继续",
  "继续执行",
  "运行",
  "确认",
  "确定",
  "确认执行",
  "是否继续",
  "继续运行",
  "运行此命令",
  "仍要继续",
  "执行",
  "恢复",
];

const DENY_LABELS = [
  "deny",
  "reject",
  "cancel",
  "dismiss",
  "close",
  "not now",
  "decline",
  "stop",
  "abort",
  "no",
  "block",
  "拒绝",
  "取消",
  "关闭",
  "暂不",
  "停止",
  "中止",
  "否",
  "阻止",
];

const APPROVAL_CONTEXT_KEYWORDS = [
  "approval",
  "approve",
  "approved",
  "computer use",
  "allow computer use",
  "allow access",
  "use app",
  "use application",
  "permission",
  "allow this",
  "requires approval",
  "needs approval",
  "reviewer",
  "sandbox",
  "escalated",
  "command",
  "shell command",
  "tool call",
  "mcp",
  "computer use",
  "full access",
  "run command",
  "request approval",
  "confirm execution",
  "execute command",
  "continue running",

  "mcp",
  "批准",
  "允许使用计算机",
  "允许访问",
  "权限",
  "需要批准",
  "请求批准",
  "审核命令",
  "运行命令",
  "执行命令",
  "确认执行",
  "运行此命令",
  "是否继续",
  "命令",
  "工具调用",
  "完全访问",
];

const APPROVAL_ACTIVATION_LABELS = [
  "waiting approval",
  "waiting for approval",
  "awaiting approval",
  "needs approval",
  "requires approval",
  "pending approval",
  "等待批准",
  "需要批准",
  "正在等待批准",
];

const APPROVAL_SIGNAL_KEYS = [
  "approval",
  "approve",
  "approved",
  "waitingonapproval",
  "waiting_on_approval",
  "waitingonuserinput",
  "waiting_on_user_input",
  "userinput",
  "user_input",
  "choice",
  "choices",
  "reviewer",
  "permission",
  "commandexecution",
  "toolcall",
  "tool_call",
  "mcp",
];

const APPROVAL_STATUS_KEYWORDS = [
  "approval",
  "awaiting approval",
  "awaiting_approval",
  "waiting on approval",
  "waiting_on_approval",
  "waiting for approval",
  "waitingonapproval",
  "waiting on user input",
  "waiting_on_user_input",
  "waiting for user input",
  "waitingonuserinput",
  "needs approval",
  "requires approval",
];

const APPROVAL_METHOD_CANDIDATES = [
  "approval/approve",
  "approval/resolve",
  "approval/respond",
  "approve-request",
  "approveRequest",
  "request/approve",
  "request/respond",
  "user-input/respond",
  "userInput/respond",
  "choice/respond",
  "choice/submit",
  "choice/select",
  "conversation/approve",
  "turn/approve",
  "thread/approve",
];

let settingsHandle = null;
let cachedLocaleOverride = null;
let localeRequestInFlight = false;

function currentLanguage() {
  const candidates = [
    cachedLocaleOverride,
    publicLanguageFromGlobals(),
    globalThis.__codexppLanguage,
    globalThis.__codexppLocale,
    documentLanguageFromHtml(),
    uiLanguageFromDocument(),
    browserLanguageFromNavigator(),
  ];
  for (const candidate of candidates) {
    const language = normalizeLanguageCandidate(candidate);
    if (language) return language;
  }
  return "zh";
}

function normalizeLanguageCandidate(candidate) {
  const value = String(candidate || "").trim().toLowerCase();
  if (!value || value === "auto" || value === "system" || value === "default") return null;
  if (value.startsWith("zh")) return "zh";
  if (value.startsWith("en")) return "en";
  return null;
}

function uiLanguageFromDocument() {
  if (typeof document === "undefined") return null;
  const text = [
    document.documentElement?.lang,
    document.body?.innerText,
    document.body?.textContent,
  ].filter(Boolean).join("\n");
  return /[\u4e00-\u9fff]/.test(text) ? "zh" : null;
}

function documentLanguageFromHtml() {
  if (typeof document === "undefined") return null;
  const value = String(document.documentElement?.lang || "").trim().toLowerCase();
  return value.startsWith("zh") ? "zh" : null;
}

function browserLanguageFromNavigator() {
  if (typeof navigator === "undefined") return null;
  const value = String(navigator.language || "").trim().toLowerCase();
  return value.startsWith("zh") ? "zh" : null;
}

function publicLanguageFromGlobals() {
  const globalCandidates = [
    globalThis.__codexppPublicSettings,
    globalThis.__codexppSettings,
    globalThis.__codex?.settings,
  ];
  for (const candidate of globalCandidates) {
    const value = candidate?.localeOverride ?? candidate?.values?.localeOverride;
    if (typeof value === "string" && value.trim()) return value;
  }
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !/codex|setting|locale|language/i.test(key)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw || !raw.includes("localeOverride")) continue;
      const parsed = JSON.parse(raw);
      const value = findLocaleOverride(parsed);
      if (value) return value;
    }
  } catch {}
  return null;
}

function findLocaleOverride(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.localeOverride === "string") return value.localeOverride;
  if (typeof value.values?.localeOverride === "string") return value.values.localeOverride;
  for (const child of Object.values(value)) {
    const result = findLocaleOverride(child);
    if (result) return result;
  }
  return null;
}

function refreshPublicLanguageSetting(onChange) {
  if (localeRequestInFlight || typeof window === "undefined") return;
  localeRequestInFlight = true;
  requestCodexSettings()
    .then((settings) => {
      const next = typeof settings?.values?.localeOverride === "string" ? settings.values.localeOverride : null;
      if (next !== cachedLocaleOverride) {
        cachedLocaleOverride = next;
        onChange?.();
      }
    })
    .catch(() => {})
    .finally(() => {
      localeRequestInFlight = false;
    });
}

function requestCodexSettings() {
  return new Promise((resolve, reject) => {
    const requestId =
      (typeof crypto !== "undefined" ? crypto.randomUUID?.() : null) ||
      `codexpp-${Date.now()}-${Math.random()}`;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    const onMessage = (event) => {
      const data = event?.data;
      if (!data || data.type !== "fetch-response" || data.requestId !== requestId) return;
      cleanup();
      if (data.responseType === "success") {
        try {
          resolve(JSON.parse(data.bodyJsonString || "{}"));
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(data.error || "Unable to read Codex settings."));
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out reading Codex settings."));
    }, 1500);
    window.addEventListener("message", onMessage);
    const message = {
      type: "fetch",
      requestId,
      url: "vscode://codex/get-settings",
      method: "POST",
      body: "{}",
      headers: {},
    };
    try {
      window.electronBridge?.sendMessageFromView?.(message)?.catch?.(() => {});
    } catch {}
    window.dispatchEvent(new CustomEvent("codex-message-from-view", { detail: message }));
  });
}

function t(key, ...args) {
  const entry = TEXT[currentLanguage()][key] ?? TEXT.en[key] ?? key;
  return typeof entry === "function" ? entry(...args) : entry;
}

function setLastAction(state, key, ...args) {
  state.lastActionTextKey = key;
  state.lastActionArgs = args;
  state.lastActionText = null;
}

function lastActionText(state) {
  if (state.lastActionTextKey) return t(state.lastActionTextKey, ...(state.lastActionArgs || []));
  return state.lastActionText || t("waiting");
}

module.exports = {
  start(api) {
    const state = createState(api);
    this._state = state;
    startRuntime(state);
    registerSettingsPage(state);
  },

  stop() {
    settingsHandle?.unregister?.();
    settingsHandle = null;
    this._state?.dispose?.();
    this._state = null;
  },
};

function createState(api) {
  return {
    api,
    enabled: api.storage.get(STORAGE_KEY_ENABLED, true) !== false,
    debug: api.storage.get(STORAGE_KEY_DEBUG, false) === true,
    observer: null,
    intervalId: 0,
    scanTimerId: 0,
    backgroundIntervalId: 0,
    routeUnpatch: null,
    clickHistory: new WeakMap(),
    activationHistory: new WeakMap(),
    approvalAttemptHistory: new Map(),
    approveCount: 0,
    backgroundApproveCount: 0,
    lastActionTextKey: "waiting",
    lastActionArgs: [],
    lastActionText: null,
    settingsRerender: null,
    dispose() {
      if (this.scanTimerId) {
        clearTimeout(this.scanTimerId);
        this.scanTimerId = 0;
      }
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = 0;
      }
      if (this.backgroundIntervalId) {
        clearInterval(this.backgroundIntervalId);
        this.backgroundIntervalId = 0;
      }
      this.observer?.disconnect?.();
      this.observer = null;
      this.routeUnpatch?.();
      this.routeUnpatch = null;
      teardownBridgeLayer(this);
      this.settingsRerender = null;
    },
  };
}

function startRuntime(state) {
  installBridgeLayer(state);
  installRouteHooks(state);
  observeDom(state);
  state.intervalId = setInterval(() => {
    scanAndApprove(state);
  }, SCAN_INTERVAL_MS);
  state.backgroundIntervalId = setInterval(() => {
    scanBackgroundApprovals(state, "interval");
  }, BACKGROUND_SCAN_INTERVAL_MS);
  scheduleScan(state, 250);
}

function registerSettingsPage(state) {
  const api = state.api;
  if (typeof api.settings?.registerPage === "function") {
    settingsHandle = api.settings.registerPage({
      id: PAGE_ID,
      title: t("pageTitle"),
      description: t("enableDescription"),
      render(root) {
        renderSettings(root, state);
      },
    });
    return;
  }
  if (typeof api.settings?.register === "function") {
    settingsHandle = api.settings.register({
      id: PAGE_ID,
      title: t("pageTitle"),
      description: t("enableDescription"),
      render(root) {
        renderSettings(root, state);
      },
    });
  }
}

function installRouteHooks(state) {
  const history = window.history;
  if (!history || history.__codexppAutoApprovePatched) {
    state.routeUnpatch = () => {};
    return;
  }

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  const notify = () => scheduleScan(state, 80);

  history.pushState = function patchedPushState(...args) {
    const result = originalPushState(...args);
    notify();
    return result;
  };
  history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState(...args);
    notify();
    return result;
  };
  history.__codexppAutoApprovePatched = true;
  window.addEventListener("popstate", notify, true);
  window.addEventListener("hashchange", notify, true);

  state.routeUnpatch = () => {
    window.removeEventListener("popstate", notify, true);
    window.removeEventListener("hashchange", notify, true);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    delete history.__codexppAutoApprovePatched;
  };
}

function observeDom(state) {
  const observer = new MutationObserver((mutations) => {
    if (!state.enabled) return;
    if (!mutations.some((mutation) => mutationLooksRelevant(mutation))) return;
    scheduleScan(state, SCAN_DEBOUNCE_MS);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
  state.observer = observer;
}

function mutationLooksRelevant(mutation) {
  const nodes = [
    mutation.target,
    ...Array.from(mutation.addedNodes || []),
    ...Array.from(mutation.removedNodes || []),
  ];
  return nodes.some((node) => nodeLooksRelevant(node));
}

function nodeLooksRelevant(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.closest?.("[data-codexpp-auto-approve-settings='true']")) return false;
  const text = visibleText(node);
  if (!text) return false;
  if (containsKeyword(text, APPROVAL_CONTEXT_KEYWORDS)) return true;
  return !!node.querySelector?.("button, [role='button']");
}

function scheduleScan(state, delayMs) {
  if (!state.enabled) return;
  if (state.scanTimerId) clearTimeout(state.scanTimerId);
  state.scanTimerId = setTimeout(() => {
    state.scanTimerId = 0;
    scanAndApprove(state);
  }, delayMs);
}

function scanAndApprove(state) {
  if (!state.enabled) return;
  const candidates = findApproveCandidates(state);
  if (candidates.length > 0) {
    const candidate = candidates[0];
    if (!clickCandidate(state, candidate)) return;
    state.approveCount += 1;
    setLastAction(state, "clicked", candidate.labelRaw);
    logDebug(state, "Clicked approval candidate", {
      label: candidate.labelRaw,
      score: candidate.score,
      contextPreview: summarizeText(candidate.contextText, 240),
    });
    state.settingsRerender?.();
    scheduleScan(state, 200);
    return;
  }

  const activationCandidates = findActivationCandidates(state);
  if (activationCandidates.length === 0) return;
  const activationCandidate = activationCandidates[0];
  if (!clickActivationCandidate(state, activationCandidate)) return;
  setLastAction(state, "activated", activationCandidate.labelRaw);
  logDebug(state, "Clicked approval activation candidate", {
    label: activationCandidate.labelRaw,
    score: activationCandidate.score,
    targetPreview: summarizeText(activationCandidate.targetText, 240),
  });
  state.settingsRerender?.();
  scheduleScan(state, 300);
}

function installBridgeLayer(state) {
  const globalState = getGlobalState();
  globalState.api = state.api;
  globalState.state = state;
  if (globalState.installScheduled) return;
  globalState.installScheduled = true;

  for (const delayMs of PATCH_RETRY_DELAYS_MS) {
    const timerId = window.setTimeout(() => {
      void runBridgeInstallCycle(state, `startup-${delayMs}`);
    }, delayMs);
    globalState.timers.add(timerId);
  }

  const readyTimerId = window.setTimeout(() => {
    void scanBackgroundApprovals(state, "startup");
  }, 1500);
  globalState.timers.add(readyTimerId);
}

function teardownBridgeLayer(state) {
  const globalState = getGlobalState();
  if (globalState.state !== state) return;

  for (const timerId of globalState.timers) {
    clearTimeout(timerId);
  }
  globalState.timers.clear();

  for (const [manager, original] of globalState.managerRestore) {
    if (manager && typeof original === "object") {
      if (typeof original.sendRequest === "function") manager.sendRequest = original.sendRequest;
      if (typeof original.addAnyConversationCallback === "function") {
        manager.addAnyConversationCallback = original.addAnyConversationCallback;
      }
    }
  }
  for (const [bridge, original] of globalState.bridgeRestore) {
    if (bridge && typeof original === "object") {
      if (typeof original.sendRequest === "function") bridge.sendRequest = original.sendRequest;
      if (typeof original.setMessageHandler === "function") bridge.setMessageHandler = original.setMessageHandler;
    }
  }

  globalState.installScheduled = false;
  globalState.patchedManagers = new WeakSet();
  globalState.patchedBridges = new WeakSet();
  globalState.managerRestore = new Map();
  globalState.bridgeRestore = new Map();
  globalState.api = null;
  globalState.state = null;
}

function getGlobalState() {
  if (!globalThis[STATE_KEY]) {
    globalThis[STATE_KEY] = {
      patchedManagers: new WeakSet(),
      patchedBridges: new WeakSet(),
      managerRestore: new Map(),
      bridgeRestore: new Map(),
      modulePromises: new Map(),
      timers: new Set(),
      installScheduled: false,
      api: null,
      state: null,
    };
  }
  return globalThis[STATE_KEY];
}

async function runBridgeInstallCycle(state, reason) {
  if (!state.enabled) return;
  try {
    await Promise.allSettled([
      installAppServerPatch(state, reason),
      patchDiscoveredManagers(state, reason),
    ]);
  } catch (error) {
    logDebug(state, "Bridge install cycle failed", {
      reason,
      error: error?.message || String(error),
    });
  }
  void scanBackgroundApprovals(state, `post-install:${reason}`);
}

function codexAppAssetUrl(namePart) {
  const urls = [
    ...Array.from(document.scripts || []).map((script) => script.src),
    ...Array.from(document.querySelectorAll("link[href]") || []).map((link) => link.href),
    ...performance.getEntriesByType("resource").map((entry) => entry.name),
  ].filter(Boolean);
  return urls.find((url) => url.includes("/assets/") && url.includes(namePart) && url.split("?")[0].endsWith(".js")) || "";
}

async function loadCodexAppModule(namePart) {
  const globalState = getGlobalState();
  if (!globalState.modulePromises.has(namePart)) {
    const promise = Promise.resolve().then(async () => {
      const url = codexAppAssetUrl(namePart);
      if (!url) throw new Error(`Codex App asset not found: ${namePart}`);
      return await import(url);
    }).catch((error) => {
      globalState.modulePromises.delete(namePart);
      throw error;
    });
    globalState.modulePromises.set(namePart, promise);
  }
  return globalState.modulePromises.get(namePart);
}

async function installAppServerPatch(state, reason) {
  let hostModule;
  try {
    hostModule = await loadCodexAppModule("app-server-manager-signals-");
  } catch (error) {
    logDebug(state, "App server patch skipped", {
      reason,
      error: error?.message || String(error),
    });
    return;
  }

  const globalState = getGlobalState();
  let patchedCount = 0;
  for (const bridge of findRequestBridgeExports(hostModule)) {
    if (!bridge || globalState.patchedBridges.has(bridge)) continue;

    const originalSendRequest = bridge.sendRequest;
    const originalSetMessageHandler = bridge.setMessageHandler;
    if (typeof originalSendRequest !== "function" || typeof originalSetMessageHandler !== "function") continue;

    bridge.sendRequest = async function patchedAutoApproveSendRequest(method, payload, options) {
      const result = await originalSendRequest.call(this, method, payload, options);
      queueBackgroundScan(state, "bridge-sendRequest", { method, payload, result });
      if (looksLikeApprovalSignal({ method, payload, result })) {
        void attemptAutoApproveFromSignal(state, this, null, {
          method,
          payload,
          result,
          source: "bridge-sendRequest",
        });
      }
      return result;
    };

    bridge.setMessageHandler = function patchedAutoApproveSetMessageHandler(handler) {
      if (typeof handler !== "function") {
        return originalSetMessageHandler.call(this, handler);
      }
      const wrappedHandler = (...args) => {
        for (const arg of args) {
          if (looksLikeApprovalSignal(arg)) {
            void attemptAutoApproveFromSignal(state, this, null, {
              message: arg,
              source: "bridge-message",
            });
          }
        }
        queueBackgroundScan(state, "bridge-message", { argCount: args.length });
        return handler.apply(this, args);
      };
      wrappedHandler.__codexppAutoApproveWrapped = true;
      wrappedHandler.__codexppAutoApproveOriginal = handler;
      return originalSetMessageHandler.call(this, wrappedHandler);
    };

    globalState.bridgeRestore.set(bridge, {
      sendRequest: originalSendRequest,
      setMessageHandler: originalSetMessageHandler,
    });
    globalState.patchedBridges.add(bridge);
    patchedCount += 1;
  }

  if (patchedCount > 0) {
    logDebug(state, "Patched app server bridges", { reason, patchedCount });
  }
}

function findRequestBridgeExports(hostModule) {
  const matches = [];
  for (const value of Object.values(hostModule || {})) {
    if (!value || typeof value !== "object") continue;
    if (typeof value.sendRequest !== "function") continue;
    if (typeof value.setMessageHandler !== "function") continue;
    matches.push(value);
  }
  return matches;
}

async function patchDiscoveredManagers(state, reason) {
  const globalState = getGlobalState();
  const managers = discoverManagers();
  let patchedCount = 0;

  for (const manager of managers) {
    if (!manager || globalState.patchedManagers.has(manager)) continue;

    const originalSendRequest = manager.sendRequest;
    const originalAddAnyConversationCallback = manager.addAnyConversationCallback;
    if (typeof originalSendRequest !== "function") continue;

    manager.sendRequest = async function patchedManagerSendRequest(method, payload, options) {
      const result = await originalSendRequest.call(this, method, payload, options);
      queueBackgroundScan(state, "manager-sendRequest", {
        method,
        hostId: safeTrimString(this?.getHostId?.()),
      });
      if (looksLikeApprovalSignal({ method, payload, result })) {
        void attemptAutoApproveFromSignal(state, null, this, {
          method,
          payload,
          result,
          source: "manager-sendRequest",
        });
      }
      return result;
    };

    if (typeof originalAddAnyConversationCallback === "function") {
      manager.addAnyConversationCallback = function patchedAddAnyConversationCallback(callback) {
        if (typeof callback !== "function") {
          return originalAddAnyConversationCallback.call(this, callback);
        }
        const wrappedCallback = (...args) => {
          for (const arg of args) {
            if (looksLikeApprovalSignal(arg)) {
              void attemptAutoApproveFromSignal(state, null, this, {
                callbackArgs: args,
                source: "conversation-callback",
              });
              break;
            }
          }
          queueBackgroundScan(state, "conversation-callback", {
            hostId: safeTrimString(this?.getHostId?.()),
          });
          return callback.apply(this, args);
        };
        return originalAddAnyConversationCallback.call(this, wrappedCallback);
      };
    }

    globalState.managerRestore.set(manager, {
      sendRequest: originalSendRequest,
      addAnyConversationCallback: originalAddAnyConversationCallback,
    });
    globalState.patchedManagers.add(manager);
    patchedCount += 1;
  }

  if (patchedCount > 0) {
    logDebug(state, "Patched discovered managers", {
      reason,
      patchedCount,
      managerCount: managers.length,
    });
  }
}

function discoverManagers() {
  const managers = new Set();
  for (const node of findAllReactRoots()) {
    const rootFiber = getFiber(node);
    walkFiberTree(rootFiber, (fiber) => {
      collectManagerCandidates(fiber.memoizedProps, new WeakSet(), managers);
      collectManagerCandidates(fiber.memoizedState, new WeakSet(), managers);
      collectManagerCandidates(fiber.stateNode, new WeakSet(), managers);
    });
  }
  return [...managers];
}

function findAllReactRoots() {
  const roots = [];
  for (const node of Array.from(document.querySelectorAll("body, body *"))) {
    for (const key of Object.keys(node || {})) {
      if (key.startsWith("__reactContainer$") || key.startsWith("__reactFiber$")) {
        roots.push(node);
        break;
      }
    }
  }
  return roots;
}

function getFiber(node) {
  for (const key of Object.keys(node || {})) {
    if (key.startsWith("__reactFiber$") || key.startsWith("__reactContainer$")) {
      return node[key] || null;
    }
  }
  return null;
}

function walkFiberTree(fiber, visit, seen = new Set()) {
  if (!fiber || seen.has(fiber)) return;
  seen.add(fiber);
  visit(fiber);
  walkFiberTree(fiber.child, visit, seen);
  walkFiberTree(fiber.sibling, visit, seen);
}

function collectManagerCandidates(value, seen, managers, depth = 0) {
  if (!value || typeof value !== "object" || seen.has(value) || depth > 4) return;
  seen.add(value);

  if (looksLikeManager(value)) {
    managers.add(value);
  }

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 30)) {
      collectManagerCandidates(item, seen, managers, depth + 1);
    }
    return;
  }

  if (typeof value.getAll === "function") {
    try {
      const items = value.getAll();
      if (Array.isArray(items)) {
        for (const item of items) {
          if (looksLikeManager(item)) managers.add(item);
        }
      }
    } catch {}
  }

  for (const key of Object.keys(value).slice(0, 100)) {
    if (/^_|fiber|return|child|sibling|stateNode|alternate/i.test(key)) continue;
    try {
      collectManagerCandidates(value[key], seen, managers, depth + 1);
    } catch {}
  }
}

function looksLikeManager(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.sendRequest === "function" &&
      (typeof value.getHostId === "function" ||
        typeof value.getConversation === "function" ||
        typeof value.addAnyConversationCallback === "function" ||
        typeof value.getCachedConversations === "function" ||
        typeof value.getRecentConversations === "function"),
  );
}

function queueBackgroundScan(state, source, payload) {
  logDebug(state, "Queueing background approval scan", {
    source,
    ...sanitizeLogPayload(payload),
  });
  window.setTimeout(() => {
    void scanBackgroundApprovals(state, source);
  }, 50);
}

async function scanBackgroundApprovals(state, source) {
  if (!state.enabled) return;
  const managers = discoverManagers();
  if (managers.length === 0) return;

  let approved = 0;
  for (const manager of managers) {
    approved += await scanManagerApprovals(state, manager, source);
  }

  if (approved > 0) {
    state.backgroundApproveCount += approved;
    state.approveCount += approved;
    state.settingsRerender?.();
  }
}

async function scanManagerApprovals(state, manager, source) {
  const conversations = collectManagerConversations(manager);
  let approved = 0;
  for (const conversation of conversations) {
    const pending = findApprovalTargets(conversation, manager);
    for (const target of pending) {
      const success = await attemptApprovalTarget(state, manager, target, source);
      if (success) approved += 1;
    }
  }
  return approved;
}

function collectManagerConversations(manager) {
  const conversations = new Map();
  const pushConversation = (conversation) => {
    const id = safeTrimString(conversation?.id || conversation?.conversationId || conversation?.threadId);
    if (!id || conversations.has(id)) return;
    conversations.set(id, conversation);
  };

  try {
    const cached = manager.getCachedConversations?.();
    if (Array.isArray(cached)) {
      for (const conversation of cached.slice(0, MAX_DISCOVERED_CONVERSATIONS)) pushConversation(conversation);
    }
  } catch {}

  try {
    const recent = manager.getRecentConversations?.();
    if (Array.isArray(recent)) {
      for (const conversation of recent.slice(0, MAX_DISCOVERED_CONVERSATIONS)) pushConversation(conversation);
    }
  } catch {}

  try {
    const trackedIds = manager.getTrackedConversationIds?.();
    if (Array.isArray(trackedIds)) {
      for (const id of trackedIds.slice(0, MAX_DISCOVERED_CONVERSATIONS)) {
        pushConversation(manager.getConversation?.(id));
      }
    }
  } catch {}

  return [...conversations.values()];
}

function findApprovalTargets(conversation, manager) {
  const results = [];
  const seen = new WeakSet();
  const conversationId = safeTrimString(
    conversation?.id || conversation?.conversationId || conversation?.threadId,
  );

  walkObjectGraph(conversation, (value, path) => {
    if (!value || typeof value !== "object") return;
    const signal = buildApprovalSignal(value, path, conversationId);
    if (!signal) return;
    if (!results.some((entry) => entry.fingerprint === signal.fingerprint)) {
      results.push({ ...signal, manager });
    }
  }, seen);

  if (results.length === 0) {
    const latestTurn = getLatestConversationTurn(conversation);
    if (latestTurn && looksLikeApprovalSignal(latestTurn)) {
      const signal = buildApprovalSignal(latestTurn, ["turns", "latest"], conversationId);
      if (signal) results.push({ ...signal, manager });
    }
  }

  return results;
}

function walkObjectGraph(value, visit, seen, path = [], depth = 0) {
  if (!value || typeof value !== "object" || seen.has(value) || depth > MAX_OBJECT_SCAN_DEPTH) return;
  seen.add(value);
  visit(value, path);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length && index < 20; index += 1) {
      walkObjectGraph(value[index], visit, seen, path.concat(index), depth + 1);
    }
    return;
  }

  for (const key of Object.keys(value).slice(0, MAX_OBJECT_SCAN_KEYS)) {
    if (/^_|memoized|alternate|child|sibling|return|stateNode/i.test(key)) continue;
    try {
      walkObjectGraph(value[key], visit, seen, path.concat(key), depth + 1);
    } catch {}
  }
}

function buildApprovalSignal(value, path, fallbackConversationId) {
  if (!looksLikeApprovalSignal(value)) return null;

  const conversationId =
    safeTrimString(value.conversationId || value.threadId || value.thread_id || value.id) ||
    fallbackConversationId;
  const requestId = safeTrimString(
    value.requestId ||
      value.request_id ||
      value.approvalRequestId ||
      value.approval_request_id ||
      value.choiceId ||
      value.choice_id ||
      value.id,
  );
  const label =
    safeTrimString(value.title) ||
    safeTrimString(value.label) ||
    safeTrimString(value.message) ||
    safeTrimString(value.status) ||
    path.join(".");
  const fingerprint = [conversationId, requestId, label, path.join(".")].filter(Boolean).join("::");

  return {
    conversationId,
    requestId,
    path,
    label,
    fingerprint,
    raw: value,
  };
}

function looksLikeApprovalSignal(value) {
  if (!value) return false;

  if (typeof value === "string") {
    return containsKeyword(value, APPROVAL_STATUS_KEYWORDS) || containsKeyword(value, APPROVAL_CONTEXT_KEYWORDS);
  }

  if (typeof value !== "object") return false;

  const pairs = [];
  for (const key of Object.keys(value).slice(0, MAX_OBJECT_SCAN_KEYS)) {
    const normalizedKey = normalizeText(key);
    const entry = value[key];
    pairs.push(normalizedKey);
    if (typeof entry === "string") {
      pairs.push(normalizeText(entry));
    } else if (typeof entry === "boolean" && entry) {
      pairs.push(normalizedKey);
    }
  }

  const combined = pairs.join(" ");
  if (containsKeyword(combined, APPROVAL_STATUS_KEYWORDS)) return true;
  if (containsKeyword(combined, APPROVAL_CONTEXT_KEYWORDS)) return true;
  return APPROVAL_SIGNAL_KEYS.some((keyword) => combined.includes(normalizeText(keyword)));
}

async function attemptAutoApproveFromSignal(state, bridge, manager, signalEnvelope) {
  const targets = [];

  if (signalEnvelope?.message && typeof signalEnvelope.message === "object") {
    const built = buildApprovalSignal(
      signalEnvelope.message,
      ["message"],
      safeTrimString(signalEnvelope.message?.conversationId || signalEnvelope.message?.threadId),
    );
    if (built) targets.push(built);
  }

  if (signalEnvelope?.result && typeof signalEnvelope.result === "object") {
    const built = buildApprovalSignal(
      signalEnvelope.result,
      ["result"],
      safeTrimString(signalEnvelope.result?.conversationId || signalEnvelope.result?.threadId),
    );
    if (built) targets.push(built);
  }

  for (const target of targets) {
    await attemptApprovalTarget(state, manager, target, signalEnvelope?.source || "signal", bridge);
  }
}

async function attemptApprovalTarget(state, manager, target, source, preferredBridge = null) {
  const key = target.fingerprint || `${target.conversationId}:${target.requestId}:${target.label}`;
  const lastAttemptAt = Number(state.approvalAttemptHistory.get(key) || 0);
  if (Date.now() - lastAttemptAt < APPROVAL_ATTEMPT_COOLDOWN_MS) {
    return false;
  }
  state.approvalAttemptHistory.set(key, Date.now());

  const transportCandidates = [preferredBridge, manager].filter(Boolean);
  const methodCandidates = buildApprovalMethodPayloads(target);

  for (const transport of transportCandidates) {
    for (const candidate of methodCandidates) {
      try {
        if (typeof transport.sendRequest !== "function") continue;
        await transport.sendRequest(candidate.method, candidate.payload, { timeoutMs: 15000 });
        setLastAction(
          state,
          "autoApproved",
          target.label || target.requestId || target.conversationId || t("request"),
          source,
        );
        state.settingsRerender?.();
        logDebug(state, "Background approval succeeded", {
          source,
          method: candidate.method,
          conversationId: target.conversationId,
          requestId: target.requestId,
          label: target.label,
        });
        scheduleScan(state, 50);
        return true;
      } catch (error) {
        logDebug(state, "Background approval attempt failed", {
          source,
          method: candidate.method,
          conversationId: target.conversationId,
          requestId: target.requestId,
          error: error?.message || String(error),
        });
      }
    }
  }

  return false;
}

function buildApprovalMethodPayloads(target) {
  const conversationId = safeTrimString(target.conversationId);
  const requestId = safeTrimString(target.requestId);
  const raw = target.raw && typeof target.raw === "object" ? target.raw : {};
  const payloadBase = compactObject({
    conversationId,
    threadId: conversationId,
    requestId,
    request_id: requestId,
    approvalRequestId: requestId,
    approval_request_id: requestId,
    choiceId: requestId,
    choice_id: requestId,
    approve: true,
    approved: true,
    accepted: true,
    allow: true,
    allowed: true,
    decision: "approve",
    response: "approve",
    selected: "approve",
    selection: "approve",
    value: true,
  });

  return APPROVAL_METHOD_CANDIDATES.map((method) => ({
    method,
    payload: compactObject({
      ...payloadBase,
      params: compactObject({
        ...payloadBase,
        id: requestId || undefined,
      }),
      request: compactObject({
        id: requestId || undefined,
        method: "approve",
        params: payloadBase,
      }),
      target: compactObject({
        id: requestId || undefined,
        conversationId,
      }),
      raw: raw && Object.keys(raw).length > 0 ? raw : undefined,
    }),
  }));
}

function compactObject(value) {
  const result = {};
  for (const [key, entry] of Object.entries(value || {})) {
    if (entry == null || entry === "") continue;
    result[key] = entry;
  }
  return result;
}

function sanitizeLogPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  const result = {};
  for (const [key, value] of Object.entries(payload).slice(0, 12)) {
    if (typeof value === "string") {
      result[key] = summarizeText(value, 140);
    } else if (typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    } else if (value && typeof value === "object") {
      result[key] = {
        keys: Object.keys(value).slice(0, 12),
      };
    }
  }
  return result;
}

function safeTrimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function findApproveCandidates(state) {
  const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
  const now = Date.now();
  return buttons
    .filter((button) => isVisibleButton(button))
    .filter((button) => !button.closest("[data-codexpp-auto-approve-settings='true']"))
    .filter((button) => !buttonIsDisabled(button))
    .filter((button) => {
      const lastClickedAt = Number(state.clickHistory.get(button) || 0);
      return now - lastClickedAt > CLICK_COOLDOWN_MS;
    })
    .map((button) => evaluateApproveCandidate(button))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);
}

function findActivationCandidates(state) {
  const elements = Array.from(document.querySelectorAll("*"));
  const now = Date.now();
  return elements
    .filter((element) => element instanceof HTMLElement)
    .filter((element) => !element.closest("[data-codexpp-auto-approve-settings='true']"))
    .filter((element) => isVisibleElement(element))
    .map((element) => evaluateActivationCandidate(state, element, now))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);
}

function evaluateActivationCandidate(state, element, now) {
  const labelRaw = visibleText(element);
  const label = normalizeText(labelRaw);
  if (!label) return null;
  if (!matchesAny(label, APPROVAL_ACTIVATION_LABELS)) return null;

  const target = findActivationTarget(element);
  if (!target || buttonIsDisabled(target)) return null;
  const lastActivatedAt = Number(state.activationHistory.get(target) || 0);
  if (now - lastActivatedAt <= ACTIVATE_COOLDOWN_MS) return null;

  const targetText = visibleText(target);
  const contextText = visibleText(findContextNode(target) || target);
  let score = 0;
  score += 90;
  if (containsKeyword(targetText, APPROVAL_CONTEXT_KEYWORDS)) score += 35;
  if (containsKeyword(contextText, APPROVAL_CONTEXT_KEYWORDS)) score += 25;
  if (target.closest("aside, nav")) score += 20;
  if (isFloatingLike(target)) score += 20;

  return {
    element,
    target,
    labelRaw,
    targetText,
    score,
  };
}

function findActivationTarget(element) {
  const selectors = [
    "button",
    "[role='button']",
    "a",
    "[role='link']",
    "[role='listitem']",
    "li",
    "[tabindex]",
    "[data-testid='conversation-turn']",
    "[data-testid='conversation-item']",
    "[data-testid='thread-list-item']",
    "article",
    "section",
  ];
  for (const selector of selectors) {
    const match = element.closest(selector);
    if (match instanceof HTMLElement) return match;
  }
  return element instanceof HTMLElement ? element : null;
}

function clickActivationCandidate(state, candidate) {
  const target = candidate.target;
  if (!target?.isConnected) return false;
  state.activationHistory.set(target, Date.now());
  try {
    target.focus?.();
  } catch {}
  try {
    target.click();
    return true;
  } catch (error) {
    state.lastActionText = error?.message || String(error);
    logDebug(state, "Failed to click activation candidate", {
      error: error?.message || String(error),
      label: candidate.labelRaw,
    });
    state.settingsRerender?.();
    return false;
  }
}

function evaluateApproveCandidate(button) {
  const labelRaw = buttonLabel(button);
  const label = normalizeText(labelRaw);
  if (!label) return null;
  if (matchesAny(label, DENY_LABELS)) return null;

  const strongApprove = matchesAny(label, STRONG_APPROVE_LABELS);
  const contextualApprove = strongApprove || matchesAny(label, CONTEXTUAL_APPROVE_LABELS);
  if (!contextualApprove) return null;

  const contextNode = findContextNode(button);
  const contextText = contextNode ? visibleText(contextNode).slice(0, MAX_CONTEXT_LENGTH) : "";
  const hasApprovalContext = containsKeyword(contextText, APPROVAL_CONTEXT_KEYWORDS);
  const isDialogLike = !!button.closest?.(
    "[role='dialog'], [role='alertdialog'], [aria-modal='true'], [data-state='open']",
  );

  if (!strongApprove && !hasApprovalContext) return null;

  let score = 0;
  if (strongApprove) score += 80;
  if (contextualApprove) score += 30;
  if (hasApprovalContext) score += 60;
  if (isDialogLike) score += 25;
  if (/mcp|command|approval|approve|allow/.test(contextText.toLowerCase())) score += 15;

  return {
    button,
    labelRaw,
    contextText,
    score,
  };
}

function findContextNode(button) {
  const selectors = [
    "[role='dialog']",
    "[role='alertdialog']",
    "[aria-modal='true']",
    "[data-state='open']",
    "article",
    "section",
    "form",
    "[data-testid='conversation-turn']",
  ];
  for (const selector of selectors) {
    const match = button.closest(selector);
    if (match) return match;
  }

  let current = button.parentElement;
  let depth = 0;
  while (current && depth < 6) {
    const text = visibleText(current);
    if (text && containsKeyword(text, APPROVAL_CONTEXT_KEYWORDS)) return current;
    current = current.parentElement;
    depth += 1;
  }
  return button.parentElement;
}

function clickCandidate(state, candidate) {
  const button = candidate.button;
  if (!button?.isConnected) return false;
  state.clickHistory.set(button, Date.now());
  try {
    if (performClick(button)) return true;
  } catch (error) {
    state.lastActionText = error?.message || String(error);
    logDebug(state, "Failed to click approval candidate", {
      error: error?.message || String(error),
      label: candidate.labelRaw,
    });
    state.settingsRerender?.();
    return false;
  }
}

function buttonLabel(button) {
  return [
    button.getAttribute?.("aria-label"),
    button.getAttribute?.("title"),
    button.innerText,
    button.textContent,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .trim()
    .toLowerCase();
}

function visibleText(node) {
  return String(node?.textContent || "").replace(/\s+/g, " ").trim();
}

function matchesAny(label, labels) {
  return labels.some((entry) => label === normalizeText(entry));
}

function containsKeyword(text, keywords) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function isVisibleButton(button) {
  if (!(button instanceof HTMLElement)) return false;
  return isVisibleElement(button);
}

function isVisibleElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function buttonIsDisabled(button) {
  return (
    button.hasAttribute?.("disabled") ||
    button.getAttribute?.("aria-disabled") === "true"
  );
}

function performClick(element) {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;

  try {
    element.scrollIntoView?.({ block: "center", inline: "center", behavior: "instant" });
  } catch {}
  try {
    element.focus?.();
  } catch {}

  const rect = element.getBoundingClientRect();
  const clientX = rect.left + Math.max(1, rect.width / 2);
  const clientY = rect.top + Math.max(1, rect.height / 2);
  const common = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 1,
  };

  dispatchMaybeMouseEvent(element, "pointerdown", common);
  dispatchMaybeMouseEvent(element, "mousedown", common);
  dispatchMaybeMouseEvent(element, "pointerup", common);
  dispatchMaybeMouseEvent(element, "mouseup", common);

  try {
    element.click();
  } catch {}

  dispatchMaybeKeyboardEvent(element, "keydown", "Enter");
  dispatchMaybeKeyboardEvent(element, "keyup", "Enter");

  return true;
}

function dispatchMaybeMouseEvent(element, type, init) {
  try {
    if (type.startsWith("pointer") && typeof PointerEvent === "function") {
      element.dispatchEvent(new PointerEvent(type, init));
      return;
    }
    if (typeof MouseEvent === "function") {
      element.dispatchEvent(new MouseEvent(type, init));
    }
  } catch {}
}

function dispatchMaybeKeyboardEvent(element, type, key) {
  try {
    if (typeof KeyboardEvent !== "function") return;
    element.dispatchEvent(new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      key,
      code: key,
    }));
  } catch {}
}

function isFloatingLike(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  return style.position === "fixed" || style.position === "sticky";
}

function summarizeText(text, limit) {
  const normalized = visibleText(text);
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function logDebug(state, message, payload) {
  if (!state.debug) return;
  state.api.log.info("[auto-approve]", message, payload || {});
}

function renderSettings(root, state) {
  root.innerHTML = "";
  root.dataset.codexppAutoApproveSettings = "true";
  root.setAttribute("data-codexpp-auto-approve-settings", "true");
  refreshPublicLanguageSetting(() => state.settingsRerender?.());

  const wrapper = el("section", "display:grid;gap:12px;");
  wrapper.append(
    sectionTitle(t("sectionTitle")),
    settingsCard([
      settingsRow({
        title: t("enableTitle"),
        description: t("enableDescription"),
        control: switchControl(state.enabled, async (value) => {
          state.enabled = value;
          state.api.storage.set(STORAGE_KEY_ENABLED, value);
          setLastAction(state, value ? "enabled" : "disabled");
          if (value) scheduleScan(state, 100);
          state.settingsRerender?.();
        }),
      }),
      settingsRow({
        title: t("debugTitle"),
        description: t("debugDescription"),
        control: switchControl(state.debug, async (value) => {
          state.debug = value;
          state.api.storage.set(STORAGE_KEY_DEBUG, value);
          state.settingsRerender?.();
        }),
      }),
      settingsRow({
        title: t("approvedCountTitle"),
        description: t("approvedCountDescription"),
        control: statusPill(String(state.approveCount), state.approveCount > 0 ? "pass" : "idle"),
      }),
      settingsRow({
        title: t("backgroundCountTitle"),
        description: t("backgroundCountDescription"),
        control: statusPill(
          String(state.backgroundApproveCount),
          state.backgroundApproveCount > 0 ? "pass" : "idle",
        ),
      }),
      settingsRow({
        title: t("lastActionTitle"),
        description: t("lastActionDescription"),
        control: textBlock(lastActionText(state)),
      }),
    ]),
    warningCard(),
  );

  root.appendChild(wrapper);
  state.settingsRerender = () => renderSettings(root, state);
}

function warningCard() {
  return settingsCard([
    settingsRow({
      title: t("riskTitle"),
      description: t("riskDescription"),
      control: statusPill(t("approvesEverything"), "warn"),
    }),
  ]);
}

function sectionTitle(text) {
  return textEl("div", text, "font-size:16px;font-weight:650;line-height:1.3;");
}

function settingsCard(children) {
  const card = el(
    "div",
    "border:1px solid var(--token-border, rgba(127,127,127,0.18));border-radius:12px;overflow:hidden;display:grid;",
  );
  for (const child of children) card.appendChild(child);
  const last = card.lastElementChild;
  if (last) last.style.borderBottom = "0";
  return card;
}

function settingsRow({ title, description, control }) {
  const row = el(
    "div",
    "display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--token-border, rgba(127,127,127,0.14));",
  );
  const copy = el("div", "display:grid;gap:2px;min-width:0;");
  copy.append(
    textEl("div", title, "font-size:14px;font-weight:550;"),
    textEl(
      "div",
      description,
      "font-size:12px;line-height:1.4;color:var(--token-text-secondary, var(--text-secondary, #666));",
    ),
  );
  row.append(copy, control);
  return row;
}

function switchControl(initial, onChange) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("role", "switch");
  const pill = document.createElement("span");
  const knob = document.createElement("span");
  knob.setAttribute(
    "style",
    "display:block;height:16px;width:16px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.12);transition:transform .2s ease-out;",
  );
  pill.appendChild(knob);

  const paint = (enabled) => {
    button.setAttribute("aria-checked", String(enabled));
    button.setAttribute(
      "style",
      "appearance:none;border:0;background:transparent;padding:0;display:inline-flex;align-items:center;cursor:pointer;",
    );
    pill.setAttribute(
      "style",
      [
        "position:relative",
        "display:inline-flex",
        "align-items:center",
        "width:32px",
        "height:20px",
        "border-radius:999px",
        "transition:background .2s ease-out",
        `background:${enabled ? "var(--token-charts-blue, #2563eb)" : "rgba(127,127,127,.35)"}`,
      ].join(";"),
    );
    knob.style.transform = enabled ? "translateX(14px)" : "translateX(2px)";
  };

  paint(initial);
  button.appendChild(pill);
  button.addEventListener("click", async () => {
    const next = button.getAttribute("aria-checked") !== "true";
    paint(next);
    await onChange(next);
  });
  return button;
}

function statusPill(text, state) {
  const palette = {
    pass: ["#0f7b45", "rgba(15,123,69,0.10)"],
    warn: ["#9a5b00", "rgba(154,91,0,0.12)"],
    idle: ["#4b5563", "rgba(107,114,128,0.14)"],
  };
  const [color, background] = palette[state] || palette.idle;
  return textEl(
    "span",
    text,
    `display:inline-flex;align-items:center;justify-content:center;min-height:24px;padding:0 9px;border-radius:999px;background:${background};color:${color};font-size:12px;font-weight:600;white-space:nowrap;`,
  );
}

function textBlock(text) {
  return textEl(
    "div",
    text,
    "max-width:360px;font-size:12px;line-height:1.45;color:var(--token-text-secondary, var(--text-secondary, #666));text-align:right;white-space:normal;",
  );
}

function el(tag, style) {
  const node = document.createElement(tag);
  if (style) node.setAttribute("style", style);
  return node;
}

function textEl(tag, text, style) {
  const node = el(tag, style);
  node.textContent = text;
  return node;
}
