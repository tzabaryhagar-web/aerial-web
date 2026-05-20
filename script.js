(function () {
  "use strict";

  const header = document.getElementById("header");
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  const navLinkItems = document.querySelectorAll(".nav__link");
  const contactForm = document.getElementById("contactForm");
  const formStatus = document.getElementById("formStatus");
  const yearEl = document.getElementById("year");

  /* Footer year */
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Header scroll state */
  function onScroll() {
    if (window.scrollY > 40) {
      header.classList.add("header--scrolled");
    } else {
      header.classList.remove("header--scrolled");
    }
    updateActiveNav();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mobile navigation */
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
      navToggle.setAttribute("aria-label", "Open menu");
      document.body.style.overflow = "";
    });
  });

  /* Active nav link on scroll */
  const sections = document.querySelectorAll("section[id]");

  function updateActiveNav() {
    const scrollPos = window.scrollY + 120;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute("id");

      if (scrollPos >= top && scrollPos < top + height) {
        navLinkItems.forEach((link) => {
          link.classList.remove("nav__link--active");
          if (link.getAttribute("href") === `#${id}`) {
            link.classList.add("nav__link--active");
          }
        });
      }
    });
  }

  /* Reveal on scroll */
  const revealEls = document.querySelectorAll(".reveal");
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

  revealEls.forEach((el) => revealObserver.observe(el));

  /* Animated stat counters */
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

  /* Skill bar animation */
  const skillFills = document.querySelectorAll(".skill-bar__fill");

  const barObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const fill = entry.target;
          const width = fill.dataset.width;
          fill.style.width = `${width}%`;
          barObserver.unobserve(fill);
        }
      });
    },
    { threshold: 0.3 }
  );

  skillFills.forEach((fill) => barObserver.observe(fill));

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

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
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
