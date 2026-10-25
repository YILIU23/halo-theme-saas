(function () {
  "use strict";

  var root = document.documentElement;
  var STORAGE_KEY = "saas-theme-mode";
  var config = window.saasThemeConfig || {};
  var messages = window.saasThemeMessages || {};

  /* ------------------------------ 明暗切换 ------------------------------ */
  // 切换时同步更新 data-mode(主题自己的变量)与
  // data-color-scheme / color-scheme-* class(官方插件组件的配色契约)
  function applyMode(mode) {
    root.setAttribute("data-mode", mode);
    root.setAttribute("data-color-scheme", mode);
    root.classList.remove("color-scheme-auto", "color-scheme-light", "color-scheme-dark");
    root.classList.add("color-scheme-" + mode);
  }

  var toggleBtn = document.getElementById("theme-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      var mode = root.getAttribute("data-mode") === "dark" ? "light" : "dark";
      applyMode(mode);
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch (e) {}
    });
  }

  // 无手动记忆时跟随系统变化
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var onSystemChange = function (e) {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (err) {}
    if (saved !== "dark" && saved !== "light") {
      applyMode(e.matches ? "dark" : "light");
    }
  };
  if (media.addEventListener) {
    media.addEventListener("change", onSystemChange);
  } else if (media.addListener) {
    // Safari < 14 只支持已废弃的 addListener
    media.addListener(onSystemChange);
  }

  /* ------------------------------ 移动端菜单 ---------------------------- */
  var navToggle = document.getElementById("nav-toggle");
  var siteNav = document.getElementById("site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ------------------------------ 阅读进度 ------------------------------ */
  var progressBar = document.getElementById("reading-progress-bar");
  var content = document.getElementById("post-content");

  if (progressBar && content) {
    var ticking = false;
    var updateProgress = function () {
      ticking = false;
      var rect = content.getBoundingClientRect();
      var viewport = window.innerHeight;
      // 正文顶部进入视口时为 0, 底部离开时约为 1
      var total = rect.height - viewport;
      var progress = total > 0 ? -rect.top / total : rect.top <= 0 ? 1 : 0;
      progress = Math.min(1, Math.max(0, progress));
      progressBar.style.transform = "scaleX(" + progress + ")";
      progressBar.parentNode.setAttribute("aria-hidden", progress < 0.01 ? "true" : "false");
    };
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(updateProgress);
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", updateProgress, { passive: true });
    updateProgress();
  }

  /* ------------------------------ 阅读时长 ------------------------------ */
  var readingTimeEl = document.getElementById("reading-time");
  if (readingTimeEl && content) {
    // 中文按字符计, 英文按词计; 400 字/分钟为常见中文阅读速度
    var text = (content.textContent || "").trim();
    var cjk = (text.match(/[一-龥]/g) || []).length;
    var words = (text.replace(/[一-龥]/g, " ").match(/[A-Za-z0-9_-]+/g) || []).length;
    var minutes = Math.max(1, Math.round((cjk + words * 2) / 400));
    var template = readingTimeEl.getAttribute("data-template") || "{0} min read";
    readingTimeEl.textContent = template.replace("{0}", minutes);
  }

  /* ------------------------------ 代码复制 ------------------------------ */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(textarea);
      ok ? resolve() : reject(new Error("copy failed"));
    });
  }

  if (config.codeCopy !== false && content) {
    content.querySelectorAll("pre").forEach(function (pre) {
      var code = pre.querySelector("code");
      if (!code) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy-btn";
      btn.textContent = messages.copyCode || "Copy";
      btn.addEventListener("click", function () {
        copyText(code.innerText).then(
          function () {
            btn.textContent = messages.copied || "Copied";
            btn.classList.add("is-copied");
            setTimeout(function () {
              btn.textContent = messages.copyCode || "Copy";
              btn.classList.remove("is-copied");
            }, 2000);
          },
          function () {
            btn.textContent = messages.copyFailed || "Copy failed";
            setTimeout(function () {
              btn.textContent = messages.copyCode || "Copy";
            }, 2000);
          }
        );
      });
      pre.appendChild(btn);
    });
  }

  /* ------------------------------ 代码高亮 ------------------------------ */
  if (window.hljs && content) {
    content.querySelectorAll("pre code").forEach(function (block) {
      window.hljs.highlightElement(block);
    });
  }

  /* -------------------------------- 目录 -------------------------------- */
  var tocNav = document.getElementById("toc");
  if (tocNav && content) {
    var headings = Array.prototype.filter.call(
      content.querySelectorAll("h2, h3, h4"),
      function (h) {
        return (h.textContent || "").trim().length > 0;
      }
    );
    if (headings.length === 0) {
      var tocWidget = document.getElementById("toc-widget");
      if (tocWidget) tocWidget.remove();
    } else {
      var ul = document.createElement("ul");
      headings.forEach(function (h, i) {
        if (!h.id) h.id = "heading-" + i;
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = h.textContent;
        a.className = "toc-h" + h.tagName.toLowerCase();
        a.setAttribute("data-target", h.id);
        li.appendChild(a);
        ul.appendChild(li);
      });
      tocNav.appendChild(ul);

      var links = tocNav.querySelectorAll("a");
      function setActive(id) {
        links.forEach(function (l) {
          l.classList.toggle("toc-active", l.getAttribute("data-target") === id);
        });
      }

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              setActive(entry.target.id);
            }
          });
        },
        { rootMargin: "0px 0px -70% 0px", threshold: 0 }
      );
      headings.forEach(function (h) {
        observer.observe(h);
      });

      // 目录点击后立即高亮,不等滚动
      links.forEach(function (l) {
        l.addEventListener("click", function () {
          setActive(l.getAttribute("data-target"));
        });
      });
    }
  }

  /* -------------------------------- 分享 -------------------------------- */
  var shareBox = document.getElementById("post-share");
  if (shareBox) {
    var shareTitle = shareBox.getAttribute("data-title") || document.title;
    var shareUrl = shareBox.getAttribute("data-url") || window.location.href;

    shareBox.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-share]");
      if (!btn) return;
      var type = btn.getAttribute("data-share");

      if (type === "copy") {
        var copyLabel = btn.textContent;
        copyText(shareUrl).then(
          function () {
            btn.textContent = messages.linkCopied || "Link copied";
            setTimeout(function () {
              btn.textContent = copyLabel;
            }, 2000);
          },
          function () {
            window.prompt(messages.shareUnsupported || "Copy the link", shareUrl);
          }
        );
        return;
      }

      var target;
      if (type === "weibo") {
        target =
          "https://service.weibo.com/share/share.php?url=" +
          encodeURIComponent(shareUrl) +
          "&title=" +
          encodeURIComponent(shareTitle);
      } else if (type === "x") {
        target =
          "https://twitter.com/intent/tweet?url=" +
          encodeURIComponent(shareUrl) +
          "&text=" +
          encodeURIComponent(shareTitle);
      }
      if (target) {
        window.open(target, "_blank", "noopener,noreferrer,width=620,height=520");
      }
    });
  }

  /* ------------------------------- 图片灯箱 ------------------------------ */
  if (config.lightbox !== false && content) {
    var lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.hidden = true;
    var lightboxImg = document.createElement("img");
    lightbox.appendChild(lightboxImg);
    var lightboxClose = document.createElement("button");
    lightboxClose.type = "button";
    lightboxClose.className = "lightbox-close";
    lightboxClose.setAttribute("aria-label", "Close");
    lightboxClose.innerHTML = "&times;";
    lightbox.appendChild(lightboxClose);
    document.body.appendChild(lightbox);

    var closeLightbox = function () {
      lightbox.hidden = true;
      document.body.classList.remove("lightbox-open");
      lightboxImg.removeAttribute("src");
    };

    content.querySelectorAll("img").forEach(function (img) {
      img.classList.add("zoomable");
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      var open = function () {
        lightboxImg.src = img.currentSrc || img.src;
        lightboxImg.alt = img.alt || "";
        lightbox.hidden = false;
        document.body.classList.add("lightbox-open");
        lightboxClose.focus();
      };
      img.addEventListener("click", open);
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });

    lightbox.addEventListener("click", function (event) {
      if (event.target !== lightboxImg) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
    });
  }

  /* ------------------------------ 返回顶部 ------------------------------ */
  var backToTop = document.getElementById("back-to-top");
  if (backToTop) {
    var toggleBackToTop = function () {
      backToTop.classList.toggle("visible", window.scrollY > 400);
    };
    window.addEventListener("scroll", toggleBackToTop, { passive: true });
    toggleBackToTop();
    backToTop.addEventListener("click", function (event) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------------------------- 站点运行天数 ---------------------------- */
  var runningEl = document.querySelector(".footer-running-days");
  if (runningEl) {
    var since = runningEl.getAttribute("data-since");
    if (since) {
      var start = new Date(since.replace(/-/g, "/")).getTime();
      if (!isNaN(start)) {
        var days = Math.max(1, Math.floor((Date.now() - start) / 86400000));
        var prefix = messages.runningPrefix || "";
        var suffix = messages.runningSuffix || "";
        runningEl.textContent = (prefix ? prefix + " " : "") + days + (suffix ? " " + suffix : "");
      }
    }
  }
})();
