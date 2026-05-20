(function () {
  "use strict";

  const STORAGE_TRICKS = "aeriarl-custom-tricks";
  const STORAGE_PERFORMANCES = "aeriarl-custom-performances";
  const STORAGE_TRICKS_OVR = "aeriarl-tricks-overrides";
  const STORAGE_PERF_OVR = "aeriarl-performances-overrides";
  const STORAGE_HIDDEN_TRICKS = "aeriarl-hidden-tricks";
  const STORAGE_HIDDEN_PERF = "aeriarl-hidden-performances";
  const STORAGE_ADMIN = "aeriarl-admin-session";
  const STORAGE_DIFFICULTY_FILTER = "aeriarl-difficulty-filter";
  const IDB_NAME = "aeriarl-video-blobs";
  const IDB_STORE = "blobs";

  let blobUrlCache = new Map();
  let editingItem = null;
  let playerModal, playerVideo;
  let currentDifficultyFilter = "beginner";

  document.addEventListener("DOMContentLoaded", init);

  /* ---------- Admin (private link: ?admin=YOUR_KEY) ---------- */
  function checkAdminFromUrl() {
    const key = new URLSearchParams(location.search).get("admin");
    if (key && key === SITE_ADMIN_KEY) {
      sessionStorage.setItem(STORAGE_ADMIN, "1");
      const url = new URL(location.href);
      url.searchParams.delete("admin");
      history.replaceState({}, "", url.pathname + url.hash);
    }
  }

  function isAdmin() {
    return sessionStorage.getItem(STORAGE_ADMIN) === "1";
  }

  function applyAdminUI() {
    document.body.classList.toggle("is-admin", isAdmin());
    const badge = document.getElementById("adminBadge");
    if (badge) badge.hidden = !isAdmin();
  }

  function promptAdminLogin() {
    const entered = prompt("Enter admin key:");
    if (entered === SITE_ADMIN_KEY) {
      sessionStorage.setItem(STORAGE_ADMIN, "1");
      applyAdminUI();
      refreshAllFeeds();
      alert("Admin mode enabled on this device.");
    } else if (entered !== null) {
      alert("Incorrect key.");
    }
  }

  function adminLogout() {
    sessionStorage.removeItem(STORAGE_ADMIN);
    applyAdminUI();
    refreshAllFeeds();
  }

  /* ---------- Init ---------- */
  async function init() {
    checkAdminFromUrl();
    applyAdminUI();

    currentDifficultyFilter = localStorage.getItem(STORAGE_DIFFICULTY_FILTER) || "beginner";

    initTheme();
    initNav();
    initContact();
    initModals();
    initPlayer();
    initDifficultyFilter();
    initTabs();

    document.getElementById("adminLoginBtn")?.addEventListener("click", () => {
      if (isAdmin()) {
        if (confirm("Leave admin mode on this device?")) adminLogout();
      } else {
        promptAdminLogin();
      }
    });

    document.getElementById("addTrickBtn")?.addEventListener("click", () => openEditModal("tricks"));
    document.getElementById("addPerformanceBtn")?.addEventListener("click", () => openEditModal("performances"));
    document.getElementById("editForm")?.addEventListener("submit", handleEditSubmit);
    document.getElementById("deleteVideoBtn")?.addEventListener("click", handleDeleteVideo);

    await refreshAllFeeds();

    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  async function refreshAllFeeds() {
    const tricks = await getFeedItems("tricks");
    const performances = await getFeedItems("performances");
    const filteredTricks = tricks.filter(t => applyDifficultyFilter(t));
    await renderFeed("tricksFeed", filteredTricks, "tricks");
    await renderFeed("performancesFeed", performances, "performances");
    initFeedSearch("tricksFeed", "tricksSearch", "tricksEmpty");
    initFeedSearch("performancesFeed", "performancesSearch", "performancesEmpty");
  }

  /* ---------- Storage ---------- */
  function getCustom(feed) {
    const key = feed === "tricks" ? STORAGE_TRICKS : STORAGE_PERFORMANCES;
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function setCustom(feed, items) {
    const key = feed === "tricks" ? STORAGE_TRICKS : STORAGE_PERFORMANCES;
    localStorage.setItem(key, JSON.stringify(items));
  }

  function getHidden(feed) {
    const key = feed === "tricks" ? STORAGE_HIDDEN_TRICKS : STORAGE_HIDDEN_PERF;
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function setHidden(feed, ids) {
    const key = feed === "tricks" ? STORAGE_HIDDEN_TRICKS : STORAGE_HIDDEN_PERF;
    localStorage.setItem(key, JSON.stringify(ids));
  }

  function getOverrides(feed) {
    const key = feed === "tricks" ? STORAGE_TRICKS_OVR : STORAGE_PERF_OVR;
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      return {};
    }
  }

  function setOverrides(feed, obj) {
    const key = feed === "tricks" ? STORAGE_TRICKS_OVR : STORAGE_PERF_OVR;
    localStorage.setItem(key, JSON.stringify(obj));
  }

  async function getFeedItems(feed) {
    const defaults = feed === "tricks" ? DEFAULT_TRICKS : DEFAULT_PERFORMANCES;
    const hidden = getHidden(feed);
    const overrides = getOverrides(feed);
    const mergedDefaults = defaults
      .map((item) => (overrides[item.id] ? { ...item, ...overrides[item.id] } : item))
      .filter((item) => !hidden.includes(item.id));
    const custom = getCustom(feed).filter((item) => !hidden.includes(item.id));
    return [...mergedDefaults, ...custom];
  }

  function defaultIds(feed) {
    return (feed === "tricks" ? DEFAULT_TRICKS : DEFAULT_PERFORMANCES).map((d) => d.id);
  }

  /* ---------- Difficulty Filter ---------- */
  function applyDifficultyFilter(trick) {
    if (currentDifficultyFilter === "all") return true;
    const tags = trick.tags || [];
    return tags.includes(currentDifficultyFilter);
  }

  function initDifficultyFilter() {
    const btns = document.querySelectorAll(".difficulty-filter__btn");
    btns.forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const value = btn.dataset.value;
        currentDifficultyFilter = value;
        localStorage.setItem(STORAGE_DIFFICULTY_FILTER, value);
        document.querySelector(".difficulty-filter").removeAttribute("open");
        await refreshAllFeeds();
      });
    });
  }

  function initTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const tabName = btn.dataset.tab;
        const feedId = tabName.includes("favorites") ? (tabName.includes("perf") ? "performancesFeedFavorites" : "tricksFeedFavorites") : (tabName.includes("perf") ? "performancesFeed" : "tricksFeed");
        const otherFeedId = feedId.includes("Favorites") ? feedId.replace("Favorites", "") : feedId + "Favorites";
        const emptyAllId = tabName.includes("perf") ? (tabName.includes("favorites") ? "performancesEmpty" : "performancesEmpty") : (tabName.includes("favorites") ? "tricksEmpty" : "tricksEmpty");
        const emptyFavId = tabName.includes("perf") ? "performancesFavoritesEmpty" : "tricksFavoritesEmpty";
        const emptyId = tabName.includes("favorites") ? emptyFavId : emptyAllId;
        const otherEmptyId = tabName.includes("favorites") ? emptyAllId : emptyFavId;
        
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-btn--active"));
        btn.classList.add("tab-btn--active");
        
        document.getElementById(feedId)?.removeAttribute("hidden");
        document.getElementById(otherFeedId)?.setAttribute("hidden", "");
        document.getElementById(emptyId)?.setAttribute("hidden", "");
        document.getElementById(otherEmptyId)?.setAttribute("hidden", "");
      });
    });
  }

  /* ---------- IndexedDB ---------- */
  function openIdb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE);
    });
  }

  async function saveBlob(id, blob) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteBlob(id) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getBlob(id) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function resolveVideoSrc(item) {
    if (item.src) return item.src;
    if (item.blobId) {
      if (blobUrlCache.has(item.blobId)) return blobUrlCache.get(item.blobId);
      const blob = await getBlob(item.blobId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        blobUrlCache.set(item.blobId, url);
        return url;
      }
    }
    return "";
  }

  /* ---------- Search ---------- */
  function matchesSearch(query, title, description) {
    if (!query) return true;
    const text = `${title} ${description}`;

    const regexMatch = query.match(/^\/(.*)\/([gimsuy]*)$/);
    if (regexMatch) {
      try {
        return new RegExp(regexMatch[1], regexMatch[2]).test(text);
      } catch {
        return false;
      }
    }

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hay = text.toLowerCase();
    return words.every((w) => hay.includes(w));
  }

  function initFeedSearch(feedId, searchId, emptyId) {
    const feed = document.getElementById(feedId);
    const search = document.getElementById(searchId);
    const empty = document.getElementById(emptyId);
    if (!feed || !search) return;

    const handler = () => {
      const q = search.value.trim();
      let visible = 0;
      feed.querySelectorAll(".video-card").forEach((card) => {
        const title = card.querySelector(".video-card__title")?.textContent || "";
        const desc = card.querySelector(".video-card__desc")?.textContent || "";
        const match = matchesSearch(q, title, desc);
        card.classList.toggle("is-hidden", !match);
        if (match) visible++;
      });
      if (empty) empty.hidden = visible > 0;
    };

    search.removeEventListener("input", search._filterHandler);
    search._filterHandler = handler;
    search.addEventListener("input", handler);
  }

  /* ---------- Video preview (mobile fix) ---------- */
  function setupVideoPreview(video) {
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.preload = "auto";

    const seekToPreview = () => {
      if (!video.duration || video.duration === Infinity) return;
      const t = Math.min(0.5, video.duration * 0.03);
      if (video.currentTime < 0.1) video.currentTime = t;
    };

    video.addEventListener("loadedmetadata", seekToPreview, { once: true });
    video.addEventListener("loadeddata", () => {
      seekToPreview();
      video.pause();
    });

    video.addEventListener("seeked", () => {
      if (!video.paused && !video.closest(".modal")) video.pause();
    });
  }

  /* ---------- Render ---------- */
  async function renderFeed(feedId, items, feedType) {
    const feed = document.getElementById(feedId);
    if (!feed) return;
    feed.innerHTML = "";
    for (const item of items) {
      feed.appendChild(await buildCard(item, feedType));
    }
  }

  async function buildCard(item, feedType) {
    const card = document.createElement("article");
    card.className = "video-card";
    card.dataset.id = item.id;

    const src = await resolveVideoSrc(item);
    const safeTitle = escapeHtml(item.title);
    const safeDesc = escapeHtml(item.description);
    const tagsHtml = (item.tags || []).map((t) => `<span>${escapeHtml(t)}</span>`).join("");
    const admin = isAdmin();

    card.innerHTML = `
      <div class="video-card__media">
        <video preload="auto" playsinline muted webkit-playsinline src="${escapeAttr(src)}"></video>
        <button type="button" class="video-card__play-btn" aria-label="Play ${safeTitle}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button type="button" class="video-card__fs-btn" aria-label="Fullscreen" title="Fullscreen">⛶</button>
      </div>
      <div class="video-card__body">
        <div class="video-card__head">
          <h3 class="video-card__title">${safeTitle}</h3>
          <button type="button" class="video-card__favorite-btn" aria-label="Add to favorites" title="Add to favorites">♡</button>
          ${admin ? `<button type="button" class="video-card__edit" aria-label="Edit" title="Edit">✎</button>` : ""}
        </div>
        <p class="video-card__desc">${safeDesc}</p>
        <div class="video-card__tags">${tagsHtml}</div>
      </div>
    `;

    const video = card.querySelector("video");
    if (video && src) setupVideoPreview(video);

    const playBtn = card.querySelector(".video-card__play-btn");
    const fsBtn = card.querySelector(".video-card__fs-btn");
    const favBtn = card.querySelector(".video-card__favorite-btn");

    playBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      openPlayer(src, item.title);
    });

    fsBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      openPlayer(src, item.title, true);
    });

    card.querySelector(".video-card__media")?.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openPlayer(src, item.title);
    });

    favBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(item.id, feedType);
      updateFavoriteButton(favBtn, item.id, feedType);
      refreshAllFeeds();
    });

    updateFavoriteButton(favBtn, item.id, feedType);

    card.querySelector(".video-card__edit")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(feedType, item);
    });

    if (!src) {
      playBtn.disabled = true;
      fsBtn.disabled = true;
    }

    return card;
  }

  function updateFavoriteButton(btn, itemId, feedType) {
    if (!btn) return;
    const isFav = isFavorited(itemId, feedType);
    btn.classList.toggle("favorited", isFav);
    btn.textContent = isFav ? "♥" : "♡";
  }

  function getFavorites(feedType) {
    const key = feedType === "tricks" ? "aeriarl-favorites-tricks" : "aeriarl-favorites-performances";
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function setFavorites(feedType, ids) {
    const key = feedType === "tricks" ? "aeriarl-favorites-tricks" : "aeriarl-favorites-performances";
    localStorage.setItem(key, JSON.stringify(ids));
  }

  function isFavorited(itemId, feedType) {
    return getFavorites(feedType).includes(itemId);
  }

  function toggleFavorite(itemId, feedType) {
    const favs = getFavorites(feedType);
    const idx = favs.indexOf(itemId);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(itemId);
    }
    setFavorites(feedType, favs);
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- Player ---------- */
  function initPlayer() {
    playerModal = document.getElementById("playerModal");
    playerVideo = document.getElementById("playerVideo");
    document.getElementById("fullscreenBtn")?.addEventListener("click", () => {
      const el = playerVideo;
      if (el?.requestFullscreen) el.requestFullscreen();
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el?.webkitEnterFullscreen) el.webkitEnterFullscreen();
    });
  }

  function openPlayer(src, title, autoFullscreen) {
    if (!src || !playerModal || !playerVideo) return;
    playerVideo.src = src;
    playerVideo.muted = false;
    playerVideo.currentTime = 0;
    playerModal.hidden = false;
    document.body.style.overflow = "hidden";

    playerVideo.play().catch(() => {
      playerVideo.muted = true;
      playerVideo.play();
    });

    if (autoFullscreen) {
      playerVideo.addEventListener(
        "playing",
        () => {
          if (playerVideo.requestFullscreen) playerVideo.requestFullscreen();
        },
        { once: true }
      );
    }
  }

  function closePlayer() {
    if (!playerModal || !playerVideo) return;
    playerVideo.pause();
    playerVideo.removeAttribute("src");
    playerVideo.load();
    playerModal.hidden = true;
    document.body.style.overflow = "";
  }

  /* ---------- Edit / delete ---------- */
  function initModals() {
    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        closeEditModal();
        closePlayer();
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeEditModal();
        closePlayer();
      }
    });
  }

  function openEditModal(feed, item) {
    if (!isAdmin()) {
      promptAdminLogin();
      return;
    }

    editingItem = item || null;
    const isEdit = Boolean(item);

    document.getElementById("editModalTitle").textContent = isEdit ? "Edit video" : "Add video";
    document.getElementById("editId").value = item?.id || `custom-${Date.now()}`;
    document.getElementById("editFeed").value = feed;
    document.getElementById("editTitle").value = item?.title || "";
    document.getElementById("editDesc").value = item?.description || "";
    document.getElementById("editUrl").value = "";
    document.getElementById("editFile").value = "";

    const mediaGroup = document.getElementById("editMediaGroup");
    const fileGroup = document.getElementById("editFileGroup");
    const deleteBtn = document.getElementById("deleteVideoBtn");

    if (isEdit) {
      mediaGroup.hidden = true;
      fileGroup.hidden = true;
      deleteBtn.hidden = false;
    } else {
      mediaGroup.hidden = false;
      fileGroup.hidden = false;
      deleteBtn.hidden = true;
    }

    document.getElementById("editModal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeEditModal() {
    document.getElementById("editModal").hidden = true;
    editingItem = null;
    if (playerModal?.hidden) document.body.style.overflow = "";
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) return;

    const id = document.getElementById("editId").value;
    const feed = document.getElementById("editFeed").value;
    const title = document.getElementById("editTitle").value.trim();
    const description = document.getElementById("editDesc").value.trim();
    const url = document.getElementById("editUrl").value.trim();
    const file = document.getElementById("editFile").files?.[0];

    if (!title || !description) return;

    const defs = defaultIds(feed);
    const isDefault = defs.includes(id);
    const isEdit = Boolean(editingItem);

    if (isEdit) {
      if (isDefault) {
        const overrides = getOverrides(feed);
        overrides[id] = { title, description };
        setOverrides(feed, overrides);
      } else {
        const custom = getCustom(feed);
        const idx = custom.findIndex((c) => c.id === id);
        if (idx >= 0) {
          custom[idx] = { ...custom[idx], title, description };
          setCustom(feed, custom);
        }
      }
      closeEditModal();
      await refreshAllFeeds();
      return;
    }

    if (!file && !url) {
      alert("Add a video URL or upload a file for new videos.");
      return;
    }

    const item = { id, title, description, tags: [], custom: true };
    if (file) {
      const blobId = `blob-${id}`;
      await saveBlob(blobId, file);
      item.blobId = blobId;
    } else {
      item.src = url;
    }

    const custom = getCustom(feed);
    custom.push(item);
    setCustom(feed, custom);
    closeEditModal();
    await refreshAllFeeds();
  }

  async function handleDeleteVideo() {
    if (!isAdmin() || !editingItem) return;
    if (!confirm(`Remove "${editingItem.title}" from the library?`)) return;

    const feed = document.getElementById("editFeed").value;
    const id = editingItem.id;
    const defs = defaultIds(feed);

    if (defs.includes(id)) {
      const hidden = getHidden(feed);
      if (!hidden.includes(id)) hidden.push(id);
      setHidden(feed, hidden);
    } else {
      const custom = getCustom(feed).filter((c) => c.id !== id);
      setCustom(feed, custom);
      if (editingItem.blobId) {
        await deleteBlob(editingItem.blobId);
        blobUrlCache.delete(editingItem.blobId);
      }
    }

    closeEditModal();
    await refreshAllFeeds();
  }

  /* ---------- Theme & nav ---------- */
  function initTheme() {
    const html = document.documentElement;
    const themeToggle = document.getElementById("themeToggle");
    const KEY = "aeriarl-theme";

    function apply(theme) {
      html.setAttribute("data-theme", theme);
      try {
        localStorage.setItem(KEY, theme);
      } catch (_) {}
    }

    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") apply(saved);
    } catch (_) {}

    themeToggle?.addEventListener("click", () => {
      apply(html.getAttribute("data-theme") === "light" ? "dark" : "light");
    });
  }

  function initNav() {
    const header = document.getElementById("header");
    const navToggle = document.getElementById("navToggle");
    const navLinks = document.getElementById("navLinks");
    const navLinkItems = document.querySelectorAll(".nav__link");

    if (header) {
      const onScroll = () => {
        header.classList.toggle("header--scrolled", window.scrollY > 40);
        const scrollPos = window.scrollY + 120;
        document.querySelectorAll("section[id]").forEach((section) => {
          const id = section.id;
          if (scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight) {
            navLinkItems.forEach((link) => {
              link.classList.toggle("nav__link--active", link.getAttribute("href") === `#${id}`);
            });
          }
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    navToggle?.addEventListener("click", () => {
      const open = navLinks.classList.toggle("nav__links--open");
      navToggle.classList.toggle("nav__toggle--open", open);
      document.body.style.overflow = open ? "hidden" : "";
    });

    navLinkItems.forEach((link) => {
      link.addEventListener("click", () => {
        navLinks?.classList.remove("nav__links--open");
        navToggle?.classList.remove("nav__toggle--open");
        document.body.style.overflow = "";
      });
    });
  }

  function initContact() {
    const form = document.getElementById("contactForm");
    const status = document.getElementById("formStatus");
    if (!form || !status) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      status.className = "form-status";
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();
      if (!name || !email || !message) {
        status.textContent = "Please fill in all fields.";
        status.classList.add("form-status--error");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = "Please enter a valid email.";
        status.classList.add("form-status--error");
        return;
      }
      status.textContent = "Thanks! Your message has been sent.";
      status.classList.add("form-status--success");
      form.reset();
      setTimeout(() => {
        status.textContent = "";
        status.className = "form-status";
      }, 4000);
    });
  }
})();