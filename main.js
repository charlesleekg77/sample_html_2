/* =====================================================================
   TENGILE MALAMALA COLLECTION — main.js
   Vanilla JS: drawer, dynamic header, reveals, accordion, tabs,
   slider, multi-step enquiry, modal, lightbox, misc.
   ===================================================================== */
(function () {
  "use strict";

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     1. Slide-out drawer (MENU / CLOSE)
  ------------------------------------------------------------------ */
  const body = document.body;
  const drawer = $("#drawer");
  const scrim = $("#scrim");
  const menuToggles = $$("[data-menu-toggle]");
  let lastFocused = null;

  function focusables(container) {
    return $$(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      container
    ).filter((el) => el.offsetParent !== null);
  }

  function openDrawer() {
    if (!drawer) return;
    lastFocused = document.activeElement;
    body.classList.add("drawer-open");
    menuToggles.forEach((t) => t.setAttribute("aria-expanded", "true"));
    drawer.setAttribute("aria-hidden", "false");
    const f = focusables(drawer);
    if (f.length) setTimeout(() => f[0].focus(), 320);
  }

  function closeDrawer() {
    if (!drawer) return;
    body.classList.remove("drawer-open");
    menuToggles.forEach((t) => t.setAttribute("aria-expanded", "false"));
    drawer.setAttribute("aria-hidden", "true");
    if (lastFocused) lastFocused.focus();
  }

  function toggleDrawer() {
    body.classList.contains("drawer-open") ? closeDrawer() : openDrawer();
  }

  menuToggles.forEach((t) => t.addEventListener("click", toggleDrawer));
  if (scrim) scrim.addEventListener("click", closeDrawer);
  if (drawer) {
    // close after choosing a link (mobile UX)
    $$("a", drawer).forEach((a) =>
      a.addEventListener("click", () => {
        if (window.innerWidth <= 860) closeDrawer();
      })
    );
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (body.classList.contains("drawer-open")) closeDrawer();
      closeModal();
      closeLightbox();
    }
    if (e.key === "Tab" && body.classList.contains("drawer-open") && drawer) {
      const f = focusables(drawer);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ------------------------------------------------------------------
     2. Dynamic / sticky header
  ------------------------------------------------------------------ */
  const header = $(".site-header");
  if (header) {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle("is-stuck", y > 40);
      // hide when scrolling down past hero, reveal on scroll up
      if (y > 420 && y > lastY + 4) header.classList.add("is-hidden");
      else if (y < lastY - 4 || y < 420) header.classList.remove("is-hidden");
      lastY = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------
     3. Scroll reveals
  ------------------------------------------------------------------ */
  const revealEls = $$(".reveal");
  if (revealEls.length) {
    if (prefersReduced || !("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-in"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              io.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
      );
      revealEls.forEach((el) => io.observe(el));
    }
  }

  /* ------------------------------------------------------------------
     4. Accordion (FAQ)
  ------------------------------------------------------------------ */
  $$("[data-accordion]").forEach((acc) => {
    const items = $$(".acc__item", acc);
    items.forEach((item) => {
      const trigger = $(".acc__trigger", item);
      const panel = $(".acc__panel", item);
      if (!trigger || !panel) return;
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        if (!acc.hasAttribute("data-multi")) {
          items.forEach((other) => {
            if (other !== item) {
              other.classList.remove("is-open");
              const op = $(".acc__panel", other);
              const ot = $(".acc__trigger", other);
              if (op) op.style.height = "0px";
              if (ot) ot.setAttribute("aria-expanded", "false");
            }
          });
        }
        item.classList.toggle("is-open", !isOpen);
        trigger.setAttribute("aria-expanded", String(!isOpen));
        panel.style.height = isOpen ? "0px" : panel.scrollHeight + "px";
      });
    });
  });
  window.addEventListener("resize", () => {
    $$(".acc__item.is-open .acc__panel").forEach((p) => { p.style.height = p.scrollHeight + "px"; });
  });

  /* ------------------------------------------------------------------
     5. Tabs
  ------------------------------------------------------------------ */
  $$("[data-tabs]").forEach((tabs) => {
    const tabBtns = $$(".tabs__tab", tabs);
    const panels = $$(".tabs__panel", tabs);
    tabBtns.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        tabBtns.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
        panels.forEach((p) => p.classList.remove("is-active"));
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        if (panels[i]) panels[i].classList.add("is-active");
      });
    });
  });

  /* ------------------------------------------------------------------
     6. Slider (image carousels)
  ------------------------------------------------------------------ */
  $$("[data-slider]").forEach((slider) => {
    const track = $(".slider__track", slider);
    const slides = $$(".slider__slide", slider);
    const dotsWrap = $(".slider__dots", slider);
    const caption = $(".slider__caption", slider);
    let index = 0;

    if (!track || !slides.length) return;

    slides.forEach((slide, i) => {
      if (dotsWrap) {
        const dot = document.createElement("button");
        dot.className = "slider__dot" + (i === 0 ? " is-active" : "");
        dot.setAttribute("aria-label", "Go to slide " + (i + 1));
        dot.addEventListener("click", () => go(i));
        dotsWrap.appendChild(dot);
      }
    });

    function render() {
      track.style.transform = `translateX(${-index * 100}%)`;
      $$(".slider__dot", slider).forEach((d, i) => d.classList.toggle("is-active", i === index));
      if (caption) {
        const cap = slides[index].getAttribute("data-caption");
        if (cap) caption.textContent = cap;
      }
    }
    function go(i) { index = (i + slides.length) % slides.length; render(); }

    const prev = $("[data-slider-prev]", slider);
    const next = $("[data-slider-next]", slider);
    if (prev) prev.addEventListener("click", () => go(index - 1));
    if (next) next.addEventListener("click", () => go(index + 1));

    // touch / swipe
    let startX = 0, dragging = false;
    track.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; dragging = true; }, { passive: true });
    track.addEventListener("touchend", (e) => {
      if (!dragging) return;
      dragging = false;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
    });

    render();
  });

  /* ------------------------------------------------------------------
     7. Enquiry modal
  ------------------------------------------------------------------ */
  const modal = $("#enquiry-modal");
  function openModal() {
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("is-locked");
    const f = focusables(modal);
    if (f.length) setTimeout(() => f[0].focus(), 200);
  }
  function closeModal() {
    if (!modal || !modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    body.classList.remove("is-locked");
    if (lastFocused) lastFocused.focus();
  }
  $$("[data-open-enquiry]").forEach((b) =>
    b.addEventListener("click", (e) => { e.preventDefault(); openModal(); })
  );
  $$("[data-close-enquiry]").forEach((b) => b.addEventListener("click", closeModal));
  const modalScrim = $(".modal__scrim", modal || document);
  if (modalScrim) modalScrim.addEventListener("click", closeModal);

  /* ------------------------------------------------------------------
     8. Multi-step form
  ------------------------------------------------------------------ */
  $$("[data-steps]").forEach((form) => {
    const panels = $$(".step-panel", form);
    const stepMarkers = $$(".steps__item", form.parentElement);
    let current = 0;

    function paint(scroll) {
      panels.forEach((p, i) => p.classList.toggle("is-active", i === current));
      stepMarkers.forEach((m, i) => {
        m.classList.toggle("is-active", i === current);
        m.classList.toggle("is-done", i < current);
      });
      if (scroll) {
        const top = form.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top, behavior: prefersReduced ? "auto" : "smooth" });
      }
    }

    form.addEventListener("click", (e) => {
      const next = e.target.closest("[data-next]");
      const back = e.target.closest("[data-back]");
      if (next) {
        e.preventDefault();
        const active = panels[current];
        const required = $$("input[required], select[required], textarea[required]", active);
        const invalid = required.find((f) => !f.checkValidity());
        if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
        if (current < panels.length - 1) { current++; paint(true); }
      }
      if (back) { e.preventDefault(); if (current > 0) { current--; paint(true); } }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const success = form.parentElement.querySelector(".form-success");
      if (success) {
        form.classList.add("hidden");
        success.classList.add("is-visible");
        stepMarkers.forEach((m) => m.classList.add("is-done"));
      }
    });

    paint();
  });

  /* ------------------------------------------------------------------
     8b. Simple forms (contact, quick enquiry)
  ------------------------------------------------------------------ */
  $$("[data-contact], [data-enquiry-quick]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const success = form.parentElement.querySelector(".form-success");
      if (success) { form.classList.add("hidden"); success.classList.add("is-visible"); }
    });
  });

  /* ------------------------------------------------------------------
     9. Lightbox (gallery)
  ------------------------------------------------------------------ */
  const lightbox = $("#lightbox");
  function openLightbox(src, alt) {
    if (!lightbox) return;
    const img = $("img", lightbox);
    if (img) { img.src = src; img.alt = alt || ""; }
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    body.classList.add("is-locked");
  }
  function closeLightbox() {
    if (!lightbox || !lightbox.classList.contains("is-open")) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    body.classList.remove("is-locked");
  }
  $$("[data-lightbox]").forEach((fig) =>
    fig.addEventListener("click", () => {
      const img = $("img", fig);
      if (img) openLightbox(img.getAttribute("data-full") || img.src, img.alt);
    })
  );
  if (lightbox) {
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox || e.target.closest("[data-lightbox-close]")) closeLightbox();
    });
  }

  /* ------------------------------------------------------------------
     10. Amenity chip filters (accommodation)
  ------------------------------------------------------------------ */
  $$("[data-filter-group]").forEach((group) => {
    const chips = $$(".chip", group);
    const targetSel = group.getAttribute("data-filter-target");
    const targets = $$(targetSel);
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const active = chip.classList.contains("is-active");
        chips.forEach((c) => c.classList.remove("is-active"));
        if (active) { targets.forEach((t) => t.classList.remove("hidden")); return; }
        chip.classList.add("is-active");
        const key = chip.getAttribute("data-filter");
        targets.forEach((t) => {
          const keys = (t.getAttribute("data-tags") || "").split(/\s+/);
          t.classList.toggle("hidden", !keys.includes(key));
        });
      });
    });
  });

  /* ------------------------------------------------------------------
     11. Misc — year, footer newsletter, current nav
  ------------------------------------------------------------------ */
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  $$("[data-newsletter]").forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("input", form);
      const note = form.parentElement.querySelector("[data-newsletter-note]");
      if (input && note) { note.textContent = "Thank you — you're on the list."; form.reset(); }
    })
  );

  // mark active drawer/footer links
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  $$("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("http")) return;
    const file = href.split("/").pop().split("#")[0].toLowerCase();
    if (file === path) a.setAttribute("aria-current", "page");
  });

  /* ------------------------------------------------------------------
     12. Hero parallax (subtle)
  ------------------------------------------------------------------ */
  if (!prefersReduced) {
    const heroMedia = $("[data-parallax]");
    if (heroMedia) {
      window.addEventListener(
        "scroll",
        () => {
          const y = Math.min(window.scrollY, 800);
          heroMedia.style.transform = `translate3d(0, ${y * 0.18}px, 0) scale(1.04)`;
        },
        { passive: true }
      );
    }
  }
})();
