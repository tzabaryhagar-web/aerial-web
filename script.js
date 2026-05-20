(function () {
  "use strict";

  const STORAGE_TRICKS = "aeriarl-custom-tricks";
  const STORAGE_PERFORMANCES = "aeriarl-custom-performances";
  const STORAGE_TRICKS_OVR = "aeriarl-tricks-overrides";
  const STORAGE_PERF_OVR = "aeriarl-performances-overrides";
  const IDB_NAME = "aeriarl-video-blobs";
  const IDB_STORE = "blobs";

  let blobUrlCache = new Map();

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    initTheme();
    initNav();
    initContact();
    initModals();
    initPlayer();

    const tricks = await getFeedItems("tricks");
    const performances = await getFeedItems("performances");

    renderFeed("tricksFeed", tricks, "tricks");
    renderFeed("performancesFeed", performances, "performances");

    initFeedSearch("tricksFeed", "tricksSearch", "tricksEmpty");
    initFeedSearch("performancesFeed", "performancesSearch", "performancesEmpty");

    document.getElementById("addTrickBtn")?.addEventListener("click", () => openEditModal("tricks"));
    document.getElementById("addPerformanceBtn")?.addEventListener("click", () => openEditModal("performances"));

    document.getElementById("editForm")?.addEventListener("submit", handleEditSubmit);

    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
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
    const overrides = getOverrides(feed);
    const mergedDefaults = defaults.map((item) =>
      overrides[item.id] ? { ...item, ...overrides[item.id] } : item
    );
    const custom = getCustom(feed);
    return [...mergedDefaults, ...custom];
  }

  function openIdb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(IDB_STORE);
      };
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

    const regexMatch = query.match(/^\/(.+)\/([gimsuy]*)$/);
    if (regexMatch) {
      try {
        const re = new RegExp(regexMatch[1], regexMatch[2]);
        return re.test(text);
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

    function filterFeed() {
      const q = search.value.trim();
      const cards = feed.querySelectorAll(".video-card");
      let visible = 0;

      cards.forEach((card) => {
        const title = card.querySelector(".video-card__title")?.textContent || "";
        const desc = card.querySelector(".video-card__desc")?.textContent || "";
        const match = matchesSearch(q, title, desc);
        card.classList.toggle("is-hidden", !match);
        if (match) visible++;
      });

      if (empty) empty.hidden = visible > 0;
    }

    search.addEventListener("input", filterFeed);
  }

  /* ---------- Render feeds ---------- */
  async function renderFeed(feedId, items, feedType) {
    const feed = document.getElementById(feedId);
    if (!feed) return;
    feed.innerHTML = "";

    for (const item of items) {
      const card = await buildCard(item, feedType);
      feed.appendChild(card);
    }
  }

  async function buildCard(item, feedType) {
    const card = document.createElement("article");
    card.className = "video-card";
    card.dataset.id = item.id;

    const src = await resolveVideoSrc(item);
    const safeTitle = escapeHtml(item.title);
    const safeDesc = escapeHtml(item.description);
    const tagsHtml = (item.tags || [])
      .map((t) => `<span>${escapeHtml(t)}</span>`)
      .join("");

    card.innerHTML = `
      <div class="video-card__media">
        <video src="${escapeAttr(src)}" preload="metadata" playsinline muted poster=""></video>
        <button type="button" class="video-card__play-btn" aria-label="Play ${safeTitle}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button type="button" class="video-card__fs-btn" aria-label="Play fullscreen" title="Fullscreen">⛶</button>
      </div>
      <div class="video-card__body">
        <div class="video-card__head">
          <h3 class="video-card__title">${safeTitle}</h3>
          <button type="button" class="video-card__edit" aria-label="Edit" title="Edit">✎</button>
        </div>
        <p class="video-card__desc">${safeDesc}</p>
        <div class="video-card__tags">${tagsHtml}</div>
      </div>
    `;

    const playBtn = card.querySelector(".video-card__play-btn");
    const fsBtn = card.querySelector(".video-card__fs-btn");
    const editBtn = card.querySelector(".video-card__edit");
    const video = card.querySelector("video");

    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPlayer(src, item.title);
    });

    fsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPlayer(src, item.title, true);
    });

    card.querySelector(".video-card__media").addEventListener("click", (e) => {
      if (e.target.closest(".video-card__edit")) return;
      if (e.target.closest(".video-card__fs-btn")) return;
      if (e.target.closest(".video-card__play-btn")) return;
      openPlayer(src, item.title);
    });

    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(feedType, item);
    });

    if (!src) {
      playBtn.disabled = true;
      fsBtn.disabled = true;
    }

    return card;
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- Video player ---------- */
  let playerModal, playerVideo, fullscreenBtn;

  function initPlayer() {
    playerModal = document.getElementById("playerModal");
    playerVideo = document.getElementById("playerVideo");
    fullscreenBtn = document.getElementById("fullscreenBtn");

    fullscreenBtn?.addEventListener("click", () => {
      const el = playerVideo;
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
    });
  }

  function openPlayer(src, title, autoFullscreen) {
    if (!src || !playerModal || !playerVideo) return;

    playerVideo.src = src;
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

  /* ---------- Edit modal ---------- */
  let editModal, editForm, editingItem = null;

  function initModals() {
    editModal = document.getElementById("editModal");
    editForm = document.getElementById("editForm");

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
    editingItem = item || null;
    document.getElementById("editModalTitle").textContent = item ? "Edit video" : "Add video";
    document.getElementById("editId").value = item?.id || `custom-${Date.now()}`;
    document.getElementById("editFeed").value = feed;
    document.getElementById("editTitle").value = item?.title || "";
    document.getElementById("editDesc").value = item?.description || "";
    document.getElementById("editUrl").value = item?.src && !item?.blobId ? item.src : "";
    document.getElementById("editFile").value = "";
    editModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeEditModal() {
    if (editModal) editModal.hidden = true;
    editingItem = null;
    if (playerModal?.hidden) document.body.style.overflow = "";
  }

  async function handleEditSubmit(e) {
    e.preventDefault();

    const id = document.getElementById("editId").value;
    const feed = document.getElementById("editFeed").value;
    const title = document.getElementById("editTitle").value.trim();
    const description = document.getElementById("editDesc").value.trim();
    const url = document.getElementById("editUrl").value.trim();
    const fileInput = document.getElementById("editFile");
    const file = fileInput.files?.[0];

    if (!title || !description) return;

    let item = {
      id,
      title,
      description,
      tags: [],
      custom: true,
    };

    if (file) {
      const blobId = `blob-${id}`;
      await saveBlob(blobId, file);
      item.blobId = blobId;
      item.src = null;
    } else if (url) {
      item.src = url;
    } else if (editingItem) {
      item.src = editingItem.src || null;
      item.blobId = editingItem.blobId || null;
    } else {
      alert("Please add a video URL or upload a file.");
      return;
    }

    const custom = getCustom(feed);
    const idx = custom.findIndex((c) => c.id === id);
    const defaultIds = (feed === "tricks" ? DEFAULT_TRICKS : DEFAULT_PERFORMANCES).map((d) => d.id);

    if (defaultIds.includes(id) && !file && !url) {
      const overrides = getOverrides(feed);
      overrides[id] = { title, description };
      setOverrides(feed, overrides);
    } else if (defaultIds.includes(id) && (file || url)) {
      item.id = `custom-${id}-${Date.now()}`;
      custom.push(item);
      setCustom(feed, custom);
    } else if (idx >= 0) {
      custom[idx] = item;
      setCustom(feed, custom);
    } else {
      custom.push(item);
      setCustom(feed, custom);
    }
    closeEditModal();

    const items = await getFeedItems(feed);
    const feedId = feed === "tricks" ? "tricksFeed" : "performancesFeed";
    await renderFeed(feedId, items, feed);

    const searchId = feed === "tricks" ? "tricksSearch" : "performancesSearch";
    const emptyId = feed === "tricks" ? "tricksEmpty" : "performancesEmpty";
    initFeedSearch(feedId, searchId, emptyId);
    document.getElementById(searchId)?.dispatchEvent(new Event("input"));
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
