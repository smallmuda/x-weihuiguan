"use strict";

const statusEl = document.getElementById("status");
const toggleBtn = document.getElementById("toggle");
const enabledInput = document.getElementById("enabled");
const dimInput = document.getElementById("dim");
const DEFAULTS = { enabled: true, dimOthers: false };

function setStatus(text) {
  statusEl.textContent = text;
}

function applyForm(settings) {
  enabledInput.checked = settings.enabled !== false;
  dimInput.checked = settings.dimOthers === true;
  toggleBtn.disabled = !enabledInput.checked;
}

chrome.storage.local.get({ xnfSettings: DEFAULTS }, (data) => {
  applyForm({ ...DEFAULTS, ...(data.xnfSettings || {}) });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.xnfSettings) return;
  applyForm({ ...DEFAULTS, ...(changes.xnfSettings.newValue || {}) });
});

function save(partial) {
  chrome.storage.local.get({ xnfSettings: DEFAULTS }, (data) => {
    const next = { ...DEFAULTS, ...(data.xnfSettings || {}), ...partial };
    chrome.storage.local.set({ xnfSettings: next });
  });
}

enabledInput.addEventListener("change", () => {
  toggleBtn.disabled = !enabledInput.checked;
  save({ enabled: enabledInput.checked });
  setStatus(enabledInput.checked ? "已开启。" : "已关闭。页面上的面板和标记都会去掉。");
});

dimInput.addEventListener("change", () => {
  save({ dimOthers: dimInput.checked });
  setStatus(dimInput.checked ? "已记住：默认淡化其他人。" : "已记住：默认不淡化其他人。");
});

function toggleOnTab(tab) {
  const url = tab && tab.url ? tab.url : "";
  if (!/^https:\/\/(x|twitter)\.com\//.test(url)) {
    setStatus("请先打开 x.com 上的关注列表页面。");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "XNF_TOGGLE" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      setStatus("面板没切过去。在扩展管理页点一次重新加载，再刷新 X 页面。");
      return;
    }
    if (response.disabled) {
      setStatus("扩展关着。先打开上面的开关。");
      return;
    }
    if (!response.ok) {
      setStatus("面板没切过去。刷新 X 页面后再点一次。");
      return;
    }
    setStatus(response.collapsed ? "面板已收起。" : "面板已展开。");
    window.setTimeout(() => window.close(), 250);
  });
}

toggleBtn.addEventListener("click", () => {
  if (!enabledInput.checked) {
    setStatus("扩展关着。先打开上面的开关。");
    return;
  }
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || !tabs || !tabs[0]) {
      chrome.tabs.query({ active: true, currentWindow: true }, (fallback) => {
        toggleOnTab(fallback && fallback[0]);
      });
      return;
    }
    toggleOnTab(tabs[0]);
  });
});
