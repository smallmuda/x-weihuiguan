"use strict";

const statusEl = document.getElementById("status");
const toggleBtn = document.getElementById("toggle");

function setStatus(text) {
  statusEl.textContent = text;
}

function toggleOnTab(tab) {
  const url = tab && tab.url ? tab.url : "";
  if (!/^https:\/\/(x|twitter)\.com\//.test(url)) {
    setStatus("请先打开 x.com 上的关注列表页面。");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "XNF_TOGGLE" }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      setStatus("面板没切过去。在扩展管理页点一次重新加载，再刷新 X 页面。");
      return;
    }
    setStatus(response.collapsed ? "面板已收起。" : "面板已展开。");
    window.setTimeout(() => window.close(), 250);
  });
}

toggleBtn.addEventListener("click", () => {
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
