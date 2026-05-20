(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const header = document.getElementById("header");
    const navToggle = document.getElementById("navToggle");
    const navLinks = document.getElementById("navLinks");
    const navLinkItems = document.querySelectorAll(".nav__link");
    const contactForm = document.getElementById("contactForm");
    const formStatus = document.getElementById("formStatus");
    const yearEl = document.getElementById("year");
    const themeToggle = document.getElementById("themeToggle");
    const html = document.documentElement;

    const THEME_KEY = "aeriarl-theme";

    if (yearEl) yearEl.textContent = new Date().getFullYear();

    function applyTheme(theme) {
      html.setAttribute("data-theme", theme);
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (_) {}
    }

    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === "light" || savedTheme === "dark") applyTheme(savedTheme);
    } catch (_) {}

    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
        applyTheme(next);
      });
    }

    if (header) {
      function onScroll() {
        header.classList.toggle("header--scrolled", window.scrollY > 40);
        updateActiveNav();
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    if (navToggle && navLinks) {
      navToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("nav__links--open");
        navToggle.classList.toggle("nav__toggle--open", isOpen);
        navToggle.setAttribute("aria-expanded", String(isOpen));
        document.body.style.overflow = isOpen ? "hidden" : "";
      });

      navLinkItems.forEach((link) => {
        link.addEventListener("click", () => {
          navLinks.classList.remove("nav__links--open");
          navToggle.classList.remove("nav__toggle--open");
          navToggle.setAttribute("aria-expanded", "false");
          document.body.style.overflow = "";
        });
      });
    }

    const sections = document.querySelectorAll("section[id]");

    function updateActiveNav() {
      const scrollPos = window.scrollY + 120;
      sections.forEach((section) => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute("id");
        if (scrollPos >= top && scrollPos < top + height) {
          navLinkItems.forEach((link) => {
            link.classList.toggle("nav__link--active", link.getAttribute("href") === `#${id}`);
          });
        }
      });
    }

    initVideoCards();
    initFeedSearch("tricksFeed", "tricksSearch", "tricksEmpty");
    initFeedSearch("projectsFeed", "projectsSearch", "projectsEmpty");

    if (contactForm && formStatus) {
      contactForm.addEventListener("submit", (e) => {
        e.preventDefault();
        formStatus.className = "form-status";
        formStatus.textContent = "";

        const name = contactForm.name.value.trim();
        const email = contactForm.email.value.trim();
        const message = contactForm.message.value.trim();

        if (!name || !email || !message) {
          formStatus.textContent = "Please fill in all fields.";
          formStatus.classList.add("form-status--error");
          return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          formStatus.textContent = "Please enter a valid email address.";
          formStatus.classList.add("form-status--error");
          return;
        }

        formStatus.textContent = "Thanks! Your message has been sent.";
        formStatus.classList.add("form-status--success");
        contactForm.reset();

        setTimeout(() => {
          formStatus.textContent = "";
          formStatus.className = "form-status";
        }, 4000);
      });
    }
  }

  function initVideoCards() {
    document.querySelectorAll(".video-card").forEach((card) => {
      const media = card.querySelector(".video-card__media");
      const video = card.querySelector("video");
      if (!media || !video) return;

      function togglePlay() {
        document.querySelectorAll(".video-card.is-playing video").forEach((v) => {
          if (v !== video) {
            v.pause();
            v.closest(".video-card").classList.remove("is-playing");
          }
        });

        if (video.paused) {
          video.muted = false;
          video.play().catch(() => {
            video.muted = true;
            video.play();
          });
          card.classList.add("is-playing");
        } else {
          video.pause();
          card.classList.remove("is-playing");
        }
      }

      media.addEventListener("click", togglePlay);
      media.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          togglePlay();
        }
      });

      video.addEventListener("ended", () => card.classList.remove("is-playing"));
    });
  }

  function initFeedSearch(feedId, searchId, emptyId) {
    const feed = document.getElementById(feedId);
    const search = document.getElementById(searchId);
    const empty = document.getElementById(emptyId);
    if (!feed || !search) return;

    const cards = feed.querySelectorAll(".video-card");

    function filterFeed() {
      const q = search.value.trim().toLowerCase();
      let visible = 0;

      cards.forEach((card) => {
        const text = card.dataset.searchText || "";
        const match = !q || text.includes(q);
        card.classList.toggle("is-hidden", !match);
        if (match) visible++;
      });

      if (empty) empty.hidden = visible > 0;
    }

    search.addEventListener("input", filterFeed);
  }
})();
