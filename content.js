"use strict";

(() => {
  if (window.__XNF_BOOTED__) return;
  window.__XNF_BOOTED__ = true;

  const FOLLOWS_YOU = new Set(["关注了你", "关注了您", "Follows you", "Follows You"]);
  const RESERVED = new Set([
    "home",
    "explore",
    "search",
    "notifications",
    "messages",
    "settings",
    "i",
    "compose",
    "intent",
  ]);
  const UNFOLLOW_GAP_MS = 1800;

  const state = {
    collapsed: false,
    enabled: true,
    dimOthers: false,
    job: 0,
    order: 0,
    byHandle: new Map(),
    confirmHandles: null,
  };

  const host = document.createElement("div");
  host.id = "xnf-root";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483646";
  host.style.top = "72px";
  host.style.right = "12px";
  host.style.display = "block";
  host.style.colorScheme = "dark";

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      .panel {
        width: 332px;
        max-height: calc(100vh - 88px);
        display: flex;
        flex-direction: column;
        border: 1px solid #38444d;
        border-radius: 16px;
        background: #15202b;
        color: #e7e9ea;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif;
        overflow: hidden;
      }
      .head, .tools, .stats, .hint, .status, .confirm {
        padding-left: 12px;
        padding-right: 12px;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-top: 10px;
        padding-bottom: 8px;
      }
      h1 {
        flex: 1;
        margin: 0;
        font-size: 14px;
        font-weight: 800;
      }
      .icon-btn, .btn, .linkish {
        font: inherit;
        cursor: pointer;
      }
      .icon-btn {
        border: 0;
        background: transparent;
        color: #8b98a5;
        border-radius: 999px;
        padding: 4px 8px;
      }
      .icon-btn:hover { background: #1e2732; color: #e7e9ea; }
      .hint {
        color: #8b98a5;
        padding-bottom: 8px;
      }
      .hint a { color: #1d9bf0; }
      .tools, .confirm {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding-bottom: 8px;
      }
      .btn {
        border: 1px solid #38444d;
        background: transparent;
        color: #e7e9ea;
        border-radius: 999px;
        padding: 5px 10px;
        font-weight: 700;
      }
      .btn:hover { background: #1e2732; }
      .btn.primary { background: #1d9bf0; border-color: #1d9bf0; color: #fff; }
      .btn.danger { background: #f4212e; border-color: #f4212e; color: #fff; }
      .btn:disabled { opacity: 0.45; cursor: default; }
      .check {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #c4ccd4;
        padding: 0 12px 8px;
      }
      .stats {
        display: flex;
        gap: 10px;
        color: #8b98a5;
        padding-bottom: 8px;
      }
      .stats b { color: #e7e9ea; font-weight: 700; }
      .status {
        min-height: 1.3em;
        color: #8b98a5;
        padding-bottom: 8px;
      }
      .list {
        overflow: auto;
        border-top: 1px solid #38444d;
        min-height: 72px;
      }
      .row {
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid #24303a;
      }
      .row img, .avatar-fallback {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        background: #38444d;
        object-fit: cover;
        flex: none;
      }
      .who { flex: 1; min-width: 0; }
      .name, .handle {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .name { font-weight: 700; }
      .handle { color: #8b98a5; }
      .handle a { color: inherit; text-decoration: none; }
      .handle a:hover { text-decoration: underline; }
      .empty { padding: 16px 12px; color: #8b98a5; }
      .done { color: #00ba7c; font-weight: 700; }
      .collapsed-tab {
        border: 0;
        border-radius: 999px;
        padding: 8px 12px;
        background: #f4212e;
        color: #fff;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
      }
    </style>
    <div class="panel" id="panel">
      <div class="head">
        <h1>未回关筛选</h1>
        <button class="icon-btn" type="button" data-action="collapse" title="收起">收起</button>
      </div>
      <div class="hint" id="hint"></div>
      <div class="tools">
        <button class="btn primary" type="button" data-action="scan">自动扫描</button>
        <button class="btn" type="button" data-button="stop" data-action="stop" disabled>停止</button>
        <button class="btn danger" type="button" data-action="unfollow-all">全部取消关注</button>
        <button class="btn" type="button" data-action="open-following" id="open-following" hidden>打开正在关注</button>
      </div>
      <label class="check">
        <input id="power" type="checkbox" checked />
        启用扩展
      </label>
      <label class="check">
        <input id="dim" type="checkbox" />
        淡化不是这类的人
      </label>
      <div class="stats" id="stats"></div>
      <div class="status" id="status">滚动列表时会顺便识别当前屏幕上的人。</div>
      <div class="confirm" id="confirm" hidden></div>
      <div class="list" id="list"></div>
    </div>
    <button class="collapsed-tab" id="tab" type="button" hidden>未回关</button>
  `;

  const $ = (id) => shadow.getElementById(id);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  function profileScreenName() {
    const match = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})(?:\/|$)/);
    if (!match || RESERVED.has(match[1])) return null;
    return match[1];
  }

  function pageKind() {
    if (/\/verified_followers\/?$/.test(location.pathname)) return "verified_followers";
    if (/\/followers\/?$/.test(location.pathname)) return "followers";
    if (/\/following\/?$/.test(location.pathname)) return "following";
    return "other";
  }

  function isListPage() {
    return pageKind() !== "other";
  }

  function setStatus(text) {
    $("status").textContent = text;
  }

  function renderHint() {
    const kind = pageKind();
    const screenName = profileScreenName();
    const followingUrl = screenName ? `https://x.com/${screenName}/following` : "";
    const openFollowing = $("open-following");
    openFollowing.hidden = !(followingUrl && (kind === "verified_followers" || kind === "followers"));
    openFollowing.dataset.url = followingUrl;
    if (kind === "following") {
      $("hint").textContent = "当前是「正在关注」。这里最适合找出你关注了、但对方没有回关的人。";
      return;
    }
    if (kind === "verified_followers" || kind === "followers") {
      const label = kind === "verified_followers" ? "已认证关注者" : "关注者";
      $("hint").innerHTML = `当前是「${label}」。插件会看每个账号旁边的按钮：保留「正在关注 / Following」，且没有「关注了你 / Follows you」的人。如果你看的是自己的关注者，对方其实已经关注了你，未回关名单在${
        followingUrl
          ? ` <a href="${followingUrl}">正在关注</a>`
          : "「正在关注」"
      }。`;
      return;
    }
    $("hint").textContent = "先打开一个主页的「正在关注」或「已认证关注者」，再开始扫描。";
  }

  function counts() {
    let oneWay = 0;
    let mutual = 0;
    let other = 0;
    for (const user of state.byHandle.values()) {
      if (user.oneWay && !user.unfollowed) oneWay += 1;
      else if (user.mutual) mutual += 1;
      else other += 1;
    }
    return { total: state.byHandle.size, oneWay, mutual, other };
  }

  function renderStats() {
    const c = counts();
    $("stats").innerHTML = `<span>已识别 <b>${c.total}</b></span><span>未回关 <b>${c.oneWay}</b></span><span>互关 <b>${c.mutual}</b></span>`;
  }

  function safeAvatar(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url, location.href);
      if (parsed.protocol === "https:" && /(^|\.)twimg\.com$/.test(parsed.hostname)) {
        return parsed.href;
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  function renderList() {
    const list = $("list");
    const scrollTop = list.scrollTop;
    const rows = [...state.byHandle.values()].filter((user) => user.oneWay);
    rows.sort((a, b) => a.order - b.order);
    if (!rows.length) {
      list.innerHTML = '<div class="empty">还没有未回关账号。滚动列表，或点「自动扫描」翻完这一页。</div>';
      return;
    }
    list.innerHTML = rows.map((user) => {
      const avatar = safeAvatar(user.avatar);
      const avatarHtml = avatar
        ? `<img alt="" src="${escapeHtml(avatar)}" />`
        : '<div class="avatar-fallback"></div>';
      const action = user.unfollowed
        ? '<span class="done">已取消</span>'
        : `<button class="btn danger" type="button" data-action="unfollow-one" data-handle="${escapeHtml(user.handle)}">取消关注</button>`;
      return `<div class="row">
        ${avatarHtml}
        <div class="who">
          <div class="name">${escapeHtml(user.name)}</div>
          <div class="handle"><a href="https://x.com/${escapeHtml(user.handle)}" target="_blank" rel="noreferrer">@${escapeHtml(user.handle)}</a></div>
        </div>
        ${action}
      </div>`;
    }).join("");
    list.scrollTop = scrollTop;
  }

  let renderTimer = 0;
  function scheduleRender() {
    renderStats();
    if (renderTimer) return;
    renderTimer = window.setTimeout(() => {
      renderTimer = 0;
      renderList();
    }, 200);
  }

  function clean(text) {
    return String(text || "").replace(/[\u200b\u200c\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim();
  }

  function buttonLabel(btn) {
    return clean(`${btn.innerText || ""} ${btn.getAttribute("aria-label") || ""}`);
  }

  function isPending(btn) {
    return /Pending|Requested|等待中|已请求|等待通过/.test(buttonLabel(btn));
  }

  function isUnfollowButton(btn) {
    const testId = btn.getAttribute("data-testid") || "";
    if (/-unfollow$/.test(testId)) return !isPending(btn);
    const text = clean(btn.innerText);
    const aria = btn.getAttribute("aria-label") || "";
    if (text === "正在关注" || text === "Following" || text === "取消关注" || text === "Unfollow") {
      return !isPending(btn);
    }
    return /^(Following|Unfollow|正在关注|取消关注)(\s|@|$)/.test(aria) && !isPending(btn);
  }

  function getUnfollowButton(root) {
    const buttons = root.querySelectorAll("button, [role='button']");
    for (const btn of buttons) {
      if (isUnfollowButton(btn)) return btn;
    }
    return null;
  }

  function followsYou(cell) {
    if (cell.querySelector("[data-testid='userFollowIndicator']")) return true;
    const nodes = cell.querySelectorAll("span, div");
    for (const node of nodes) {
      if (node.closest("button, [role='button']")) continue;
      if (FOLLOWS_YOU.has(clean(node.getAttribute("aria-label") || ""))) return true;
      if (node.children.length) continue;
      if (FOLLOWS_YOU.has(clean(node.textContent))) return true;
    }
    return false;
  }

  function readHandle(cell) {
    const spans = cell.querySelectorAll("span");
    for (const span of spans) {
      if (span.children.length) continue;
      const text = span.textContent.trim();
      if (/^@[A-Za-z0-9_]{1,15}$/.test(text)) return text.slice(1);
    }
    const links = cell.querySelectorAll("a[href]");
    for (const link of links) {
      const match = (link.getAttribute("href") || "").match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
      if (match && !RESERVED.has(match[1])) return match[1];
    }
    const unfollow = getUnfollowButton(cell);
    const aria = unfollow ? unfollow.getAttribute("aria-label") || "" : "";
    const fromAria = aria.match(/@([A-Za-z0-9_]{1,15})/);
    return fromAria ? fromAria[1] : null;
  }

  function readName(cell, handle) {
    const links = [...cell.querySelectorAll("a[href]")];
    const link = links.find((item) => {
      const href = item.getAttribute("href") || "";
      return href === `/${handle}` || href.startsWith(`/${handle}?`);
    });
    const scope = link || cell;
    const span = [...scope.querySelectorAll("span")].find((item) => {
      if (item.children.length) return false;
      const text = item.textContent.trim();
      return text && text !== `@${handle}`;
    });
    return span ? span.textContent.trim() : handle;
  }

  function readAvatar(cell) {
    const image = cell.querySelector("img[src]");
    return image ? image.getAttribute("src") : "";
  }

  function parseCell(cell) {
    if (!cell || cell.closest("#xnf-root")) return null;
    const handle = readHandle(cell);
    if (!handle) return null;
    const unfollowBtn = getUnfollowButton(cell);
    const youFollow = Boolean(unfollowBtn);
    const theyFollow = followsYou(cell);
    return {
      handle,
      name: readName(cell, handle),
      avatar: readAvatar(cell),
      youFollow,
      theyFollow,
      mutual: youFollow && theyFollow,
      oneWay: youFollow && !theyFollow,
    };
  }

  function getColumn() {
    return document.querySelector('[data-testid="primaryColumn"]');
  }

  function cardFromButton(btn) {
    const direct = btn.closest('[data-testid="UserCell"]');
    if (direct) return direct;
    const column = getColumn();
    let el = btn.parentElement;
    while (el && el !== column && el !== document.body) {
      const text = el.innerText || "";
      if (/@[A-Za-z0-9_]{1,15}/.test(text) && text.length < 900) return el;
      el = el.parentElement;
    }
    return null;
  }

  function getCells() {
    const scope = getColumn() || document.body;
    const cells = [...scope.querySelectorAll('[data-testid="UserCell"]')];
    if (cells.length) return cells;
    const seen = new Set();
    const cards = [];
    scope.querySelectorAll("button, [role='button']").forEach((btn) => {
      if (!isUnfollowButton(btn) && !/^-?follow$/.test((btn.getAttribute("data-testid") || "").slice(-6))) {
        const testId = btn.getAttribute("data-testid") || "";
        if (!/-follow$/.test(testId)) return;
      }
      const card = cardFromButton(btn);
      if (!card || seen.has(card)) return;
      seen.add(card);
      cards.push(card);
    });
    return cards;
  }

  function remember(info) {
    const prev = state.byHandle.get(info.handle);
    if (prev?.unfollowed) return false;
    if (prev) {
      const avatar = safeAvatar(info.avatar) ? info.avatar : prev.avatar;
      const next = { ...prev, ...info, avatar, order: prev.order, unfollowed: false };
      const changed = prev.oneWay !== next.oneWay || prev.mutual !== next.mutual || prev.name !== next.name;
      state.byHandle.set(info.handle, next);
      return changed;
    }
    state.order += 1;
    state.byHandle.set(info.handle, { ...info, order: state.order, unfollowed: false });
    return true;
  }

  function markCell(cell, kind) {
    if (!kind) cell.removeAttribute("data-xnf");
    else cell.setAttribute("data-xnf", kind);
  }

  function paintCells() {
    for (const cell of getCells()) {
      const info = parseCell(cell);
      if (!info) continue;
      if (state.byHandle.get(info.handle)?.unfollowed) {
        markCell(cell, state.dimOthers ? "dim" : "");
        continue;
      }
      remember(info);
      if (info.oneWay) markCell(cell, "hit");
      else markCell(cell, state.dimOthers ? "dim" : "");
    }
  }

  let paintScheduled = false;
  function schedulePaint() {
    if (!state.enabled || paintScheduled) return;
    paintScheduled = true;
    requestAnimationFrame(() => {
      paintScheduled = false;
      const before = counts().oneWay;
      paintCells();
      const after = counts().oneWay;
      if (after !== before) scheduleRender();
      else renderStats();
    });
  }

  function getScroller() {
    let el = getColumn();
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      const scrollable = (style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 80;
      if (scrollable) return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function scrollToTop() {
    const scroller = getScroller();
    scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function scrollDown() {
    const scroller = getScroller();
    const before = scroller.scrollTop;
    const delta = Math.round((scroller.clientHeight || window.innerHeight) * 0.72);
    if (typeof scroller.scrollBy === "function") scroller.scrollBy(0, delta);
    else scroller.scrollTop += delta;
    if (scroller.scrollTop !== before) return true;
    const y = window.scrollY;
    window.scrollBy(0, delta);
    return window.scrollY !== y;
  }

  function atBottom() {
    const scroller = getScroller();
    return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
      && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
  }

  function findCell(handle) {
    return getCells().find((cell) => parseCell(cell)?.handle.toLowerCase() === handle.toLowerCase()) || null;
  }

  async function confirmUnfollowDialog() {
    const started = Date.now();
    while (Date.now() - started < 2000) {
      const direct = document.querySelector("[data-testid='confirmationSheetConfirm']");
      if (direct) {
        direct.click();
        return true;
      }
      const dialogs = document.querySelectorAll("[role='dialog'], [data-testid='confirmationSheetDialog']");
      for (const dialog of dialogs) {
        const buttons = dialog.querySelectorAll("button, [role='button']");
        for (const button of buttons) {
          const text = clean(button.innerText);
          if (text === "取消关注" || text === "Unfollow") {
            button.click();
            return true;
          }
        }
      }
      await sleep(80);
    }
    return false;
  }

  async function unfollowCell(cell) {
    const button = getUnfollowButton(cell);
    if (!button) return false;
    button.click();
    const confirmed = await confirmUnfollowDialog();
    await sleep(250);
    return confirmed || !getUnfollowButton(cell);
  }

  async function locateCell(handle, jobId) {
    let cell = findCell(handle);
    if (cell) {
      cell.scrollIntoView({ block: "center", inline: "nearest" });
      await sleep(200);
      return findCell(handle) || cell;
    }
    scrollToTop();
    await sleep(500);
    let stuck = 0;
    while (state.job === jobId && stuck < 4) {
      cell = findCell(handle);
      if (cell) {
        cell.scrollIntoView({ block: "center", inline: "nearest" });
        await sleep(200);
        return findCell(handle) || cell;
      }
      if (atBottom() || !scrollDown()) stuck += 1;
      else stuck = 0;
      await sleep(450);
    }
    return null;
  }

  function setBusy(busy) {
    shadow.querySelectorAll("[data-action='scan'], [data-action='unfollow-all'], [data-action='unfollow-one']").forEach((btn) => {
      btn.disabled = busy;
    });
    const stop = shadow.querySelector("[data-button='stop']");
    stop.disabled = !busy;
  }

  async function runScan() {
    const jobId = ++state.job;
    setBusy(true);
    setStatus("从列表顶部开始扫描…");
    scrollToTop();
    await sleep(600);
    let stuck = 0;
    let lastCount = -1;
    while (state.job === jobId && stuck < 4) {
      paintCells();
      scheduleRender();
      const total = state.byHandle.size;
      setStatus(`正在扫描，已识别 ${total} 人，未回关 ${counts().oneWay} 人。`);
      if (atBottom() || !scrollDown()) stuck += 1;
      else if (total === lastCount) stuck += 1;
      else stuck = 0;
      lastCount = state.byHandle.size;
      await sleep(700);
    }
    if (state.job !== jobId) return;
    paintCells();
    renderList();
    renderStats();
    setBusy(false);
    setStatus(`扫描结束。未回关 ${counts().oneWay} 人。`);
  }

  async function unfollowHandle(handle, jobId) {
    setStatus(`正在定位 @${handle} …`);
    const cell = await locateCell(handle, jobId);
    if (state.job !== jobId) return false;
    if (!cell) {
      setStatus(`没在当前列表里找到 @${handle}。先自动扫描，或打开这个账号主页手动取消。`);
      return false;
    }
    const info = parseCell(cell);
    if (!info?.youFollow) {
      const user = state.byHandle.get(handle);
      if (user) user.unfollowed = true;
      return false;
    }
    if (info.theyFollow) {
      setStatus(`@${handle} 现在显示为已回关，已跳过。`);
      remember(info);
      return false;
    }
    setStatus(`正在取消关注 @${handle} …`);
    const ok = await unfollowCell(cell);
    const user = state.byHandle.get(handle);
    if (ok && user) {
      user.unfollowed = true;
      user.youFollow = false;
      user.oneWay = false;
      markCell(cell, state.dimOthers ? "dim" : "");
    }
    return ok;
  }

  async function runUnfollowAll() {
    const handles = [...state.byHandle.values()]
      .filter((user) => user.oneWay && !user.unfollowed)
      .sort((a, b) => a.order - b.order)
      .map((user) => user.handle);
    if (!handles.length) {
      setStatus("没有可取消关注的未回关账号。");
      return;
    }
    const jobId = ++state.job;
    setBusy(true);
    let done = 0;
    for (const handle of handles) {
      if (state.job !== jobId) return;
      const ok = await unfollowHandle(handle, jobId);
      if (ok) done += 1;
      renderList();
      renderStats();
      setStatus(`已取消 ${done} / ${handles.length}。`);
      if (state.job !== jobId) return;
      await sleep(UNFOLLOW_GAP_MS);
    }
    if (state.job !== jobId) return;
    setBusy(false);
    setStatus(`批量取消结束，成功 ${done} 人。`);
  }

  function hideConfirm() {
    state.confirmHandles = null;
    const box = $("confirm");
    box.hidden = true;
    box.innerHTML = "";
  }

  function showConfirm(count) {
    const box = $("confirm");
    box.hidden = false;
    box.innerHTML = `<span>取消关注这 ${count} 个未回关账号？每次大约间隔 2 秒。</span>
      <button class="btn danger" type="button" data-action="confirm-unfollow">确认取消</button>
      <button class="btn" type="button" data-action="cancel-unfollow">返回</button>`;
  }

  function clearMarks(kind) {
    const selector = kind ? `[data-xnf="${kind}"]` : "[data-xnf]";
    document.querySelectorAll(selector).forEach((el) => el.removeAttribute("data-xnf"));
  }

  function applyCollapsed() {
    $("panel").hidden = state.collapsed || !state.enabled;
    $("tab").hidden = !state.collapsed || !state.enabled;
  }

  function applyEnabled() {
    $("power").checked = state.enabled;
    $("dim").checked = state.dimOthers;
    if (!state.enabled) {
      stopJob();
      clearMarks();
      host.style.display = "none";
      applyCollapsed();
      return;
    }
    host.style.display = "block";
    applyCollapsed();
  }

  function saveSettings() {
    applyEnabled();
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    chrome.storage.local.set({
      xnfSettings: { enabled: state.enabled, dimOthers: state.dimOthers },
    });
  }

  function stopJob() {
    state.job += 1;
    setBusy(false);
    hideConfirm();
    setStatus("已停止。");
  }

  shadow.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === "open-following") {
      const url = target.dataset.url;
      if (url) location.assign(url);
      return;
    }
    if (action === "collapse") {
      state.collapsed = true;
      applyCollapsed();
      return;
    }
    if (!state.enabled) return;
    if (action === "scan") {
      hideConfirm();
      runScan();
      return;
    }
    if (action === "stop") {
      stopJob();
      return;
    }
    if (action === "unfollow-all") {
      const pending = [...state.byHandle.values()].filter((user) => user.oneWay && !user.unfollowed);
      if (!pending.length) {
        setStatus("没有可取消关注的未回关账号。可以先自动扫描。");
        return;
      }
      showConfirm(pending.length);
      return;
    }
    if (action === "cancel-unfollow") {
      hideConfirm();
      return;
    }
    if (action === "confirm-unfollow") {
      hideConfirm();
      runUnfollowAll();
      return;
    }
    if (action === "unfollow-one") {
      const handle = target.dataset.handle;
      const jobId = ++state.job;
      setBusy(true);
      unfollowHandle(handle, jobId).then((ok) => {
        if (state.job !== jobId) return;
        renderList();
        renderStats();
        setBusy(false);
        if (ok) setStatus(`已取消关注 @${handle}。`);
      });
    }
  });

  shadow.addEventListener("change", (event) => {
    if (event.target.id === "power") {
      state.enabled = event.target.checked;
      if (state.enabled) state.collapsed = false;
      saveSettings();
      if (state.enabled) schedulePaint();
      return;
    }
    if (event.target.id !== "dim") return;
    state.dimOthers = event.target.checked;
    if (!state.dimOthers) clearMarks("dim");
    saveSettings();
    schedulePaint();
  });

  $("tab").addEventListener("click", () => {
    state.collapsed = false;
    applyCollapsed();
    renderHint();
    schedulePaint();
  });

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.type !== "XNF_TOGGLE") return;
      if (!state.enabled) {
        sendResponse({ ok: false, disabled: true });
        return true;
      }
      state.collapsed = !state.collapsed;
      applyCollapsed();
      sendResponse({ ok: true, collapsed: state.collapsed });
      return true;
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.xnfSettings) return;
      const settings = changes.xnfSettings.newValue || {};
      if (typeof settings.enabled === "boolean") state.enabled = settings.enabled;
      if (typeof settings.dimOthers === "boolean") state.dimOthers = settings.dimOthers;
      if (!state.dimOthers) clearMarks("dim");
      applyEnabled();
      if (state.enabled) {
        watchColumn();
        schedulePaint();
      }
    });
  }

  function mount() {
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  window.addEventListener("scroll", schedulePaint, true);

  let observedColumn = null;
  const columnObserver = new MutationObserver(() => schedulePaint());

  function watchColumn() {
    const column = getColumn();
    if (!column || column === observedColumn) return;
    columnObserver.disconnect();
    columnObserver.observe(column, { childList: true, subtree: true });
    observedColumn = column;
    schedulePaint();
  }

  let lastPath = location.pathname;
  setInterval(() => {
    if (!state.enabled) return;
    mount();
    watchColumn();
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      renderHint();
      schedulePaint();
    }
  }, 1000);

  function start() {
    state.collapsed = !isListPage();
    $("dim").checked = state.dimOthers;
    $("power").checked = state.enabled;
    renderHint();
    renderStats();
    renderList();
    applyEnabled();
    mount();
    if (!state.enabled) return;
    watchColumn();
    schedulePaint();
  }

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get({ xnfSettings: { enabled: true, dimOthers: false } }, (data) => {
      const settings = data.xnfSettings || {};
      if (typeof settings.enabled === "boolean") state.enabled = settings.enabled;
      if (typeof settings.dimOthers === "boolean") state.dimOthers = settings.dimOthers;
      start();
    });
  } else {
    start();
  }
})();
