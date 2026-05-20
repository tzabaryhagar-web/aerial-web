(function () {
  "use strict";

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

  /* Footer year */
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Theme toggle */
  function applyTheme(theme) {
    html.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    applyTheme(savedTheme);
  }

  themeToggle.addEventListener("click", () => {
    const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next);
  });

  /* Header scroll */
  function onScroll() {
    header.classList.toggle("header--scrolled", window.scrollY > 40);
    updateActiveNav();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mobile nav */
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("nav__links--open");
    navToggle.classList.toggle("nav__toggle--open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
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

  /* Active nav */
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

  /* Reveal on scroll */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal--visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

  /* Stat counters */
  const statNums = document.querySelectorAll(".hero__stat-num[data-count]");

  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const statsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          statNums.forEach(animateCounter);
          statsObserver.disconnect();
        }
      });
    },
    { threshold: 0.5 }
  );

  const heroStats = document.querySelector(".hero__stats");
  if (heroStats) statsObserver.observe(heroStats);

  /* Video feed builder */
  function createVideoCard(item) {
    const card = document.createElement("article");
    card.className = "video-card reveal";
    card.dataset.searchText = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();

    card.innerHTML = `
      <div class="video-card__media" role="button" tabindex="0" aria-label="Play ${item.title}">
        <video src="${item.src}" preload="metadata" playsinline loop muted></video>
        <div class="video-card__play" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <div class="video-card__body">
        <h3 class="video-card__title">${item.title}</h3>
        <p class="video-card__desc">${item.description}</p>
        <div class="video-card__tags">${item.tags.map((t) => `<span>${t}</span>`).join("")}</div>
      </div>
    `;

    const media = card.querySelector(".video-card__media");
    const video = card.querySelector("video");

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

    return card;
  }

  function initFeed(feedId, emptyId, videos, searchId) {
    const feed = document.getElementById(feedId);
    const empty = document.getElementById(emptyId);
    const search = document.getElementById(searchId);
    const cards = [];

    videos.forEach((item) => {
      const card = createVideoCard(item);
      feed.appendChild(card);
      cards.push(card);
      revealObserver.observe(card);
    });

    function filterFeed(query) {
      const q = query.trim().toLowerCase();
      let visible = 0;

      cards.forEach((card) => {
        const match = !q || card.dataset.searchText.includes(q);
        card.classList.toggle("is-hidden", !match);
        if (match) visible++;
      });

      empty.hidden = visible > 0;
    }

    search.addEventListener("input", () => filterFeed(search.value));
  }

  initFeed("tricksFeed", "tricksEmpty", TRICKS_VIDEOS, "tricksSearch");
  initFeed("projectsFeed", "projectsEmpty", PROJECTS_VIDEOS, "projectsSearch");

  /* Contact form */
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
})();
