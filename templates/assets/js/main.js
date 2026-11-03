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
      // 按 h2/h3/h4 生成嵌套 <ul>, 而不是拉平后靠内边距伪装层级。
      // 栈里每一帧代表一个目录层级, 初始层级取第一个标题 (通常是 h2 = 1)。
      var rootList = document.createElement("ul");
      var firstLevel = Math.max(1, Number(headings[0].tagName.charAt(1)) - 1);
      var stack = [{ level: firstLevel, list: rootList }];
      headings.forEach(function (h, i) {
        if (!h.id) h.id = "heading-" + i;
        var level = Number(h.tagName.charAt(1)) - 1; // h2 -> 1, h3 -> 2, h4 -> 3
        if (!(level >= 1)) level = 1;

        // 回到第一个比当前层级更浅的帧
        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        var frame = stack[stack.length - 1];

        // 跳级 (h2 直接接 h4) 时只降一层, 不补空节点
        if (level > frame.level + 1) level = frame.level + 1;

        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = h.textContent;
        // 类名必须是 toc-h2 / toc-h3 / toc-h4 —— 之前写成 "toc-h" + "h2",
        // 拼出 toc-hh2, 样式表里的 .toc-h3 / .toc-h4 从来没匹配上过。
        a.className = "toc-" + h.tagName.toLowerCase();
        a.setAttribute("data-target", h.id);
        li.appendChild(a);

        if (level > frame.level) {
          var lastLi = frame.list.lastElementChild;
          if (lastLi) {
            // 复用已存在的子列表, 避免同一个父项下面挂出两个 <ul>
            var sub = lastLi.lastElementChild;
            if (!sub || sub.tagName !== "UL") {
              sub = document.createElement("ul");
              lastLi.appendChild(sub);
            }
            frame = { level: level, list: sub };
            stack.push(frame);
          }
        }
        frame.list.appendChild(li);
      });
      tocNav.appendChild(rootList);

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

      if (type === "markdown") {
        var md = "[" + shareTitle + "](" + shareUrl + ")";
        var mdLabel = btn.textContent;
        copyText(md).then(
          function () {
            btn.textContent = messages.copiedMarkdown || "Markdown copied";
            setTimeout(function () {
              btn.textContent = mdLabel;
            }, 2000);
          },
          function () {
            window.prompt(messages.shareUnsupported || "Copy the link", md);
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
      } else if (type === "telegram") {
        target =
          "https://t.me/share/url?url=" +
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
  // 系统开启「减少动态效果」时不做平滑滚动, 与 style.css 里的 @media 保持一致
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var backToTop = document.getElementById("back-to-top");
  if (backToTop) {
    var toggleBackToTop = function () {
      backToTop.classList.toggle("visible", window.scrollY > 400);
    };
    window.addEventListener("scroll", toggleBackToTop, { passive: true });
    toggleBackToTop();
    backToTop.addEventListener("click", function (event) {
      event.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });
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

  /* ------------------------------ 归档筛选 ------------------------------ */
  // 只过滤当前这一页: Halo 的归档接口是分页的, 前端拿不到全量数据。
  var archiveToolbar = document.getElementById("archive-toolbar");
  var archiveList = document.getElementById("archive-list");
  var archiveInput = document.getElementById("archive-filter");
  var archiveStatus = document.getElementById("archive-filter-status");
  if (archiveToolbar && archiveList && archiveInput) {
    var archiveItems = Array.prototype.slice.call(
      archiveList.querySelectorAll(".archive-item")
    );
    var archiveTotal = archiveItems.length;
    var archiveMsgCount = archiveToolbar.getAttribute("data-msg-count") || "%1 / %2";
    var archiveMsgEmpty = archiveToolbar.getAttribute("data-msg-empty") || "";

    var applyArchiveFilter = function (raw) {
      var q = (raw || "").trim().toLowerCase();
      var shown = 0;
      archiveItems.forEach(function (item) {
        var hit = !q || (item.textContent || "").toLowerCase().indexOf(q) !== -1;
        item.hidden = !hit;
        if (hit) shown++;
      });
      // 先折叠月份, 再折叠年份, 免得留下只有标题没有内容的空组
      Array.prototype.forEach.call(
        archiveList.querySelectorAll(".archive-month"),
        function (month) {
          month.hidden = month.querySelectorAll(".archive-item:not([hidden])").length === 0;
        }
      );
      Array.prototype.forEach.call(
        archiveList.querySelectorAll(".archive-group"),
        function (group) {
          group.hidden = group.querySelectorAll(".archive-month:not([hidden])").length === 0;
        }
      );

      if (archiveStatus) {
        if (!q) {
          archiveStatus.textContent = "";
        } else if (shown === 0) {
          archiveStatus.textContent = archiveMsgEmpty;
        } else {
          archiveStatus.textContent = archiveMsgCount
            .replace("%1", shown)
            .replace("%2", archiveTotal);
        }
      }

      // 同步到地址栏, 筛选结果可以直接分享
      try {
        var url = new URL(window.location.href);
        if (q) url.searchParams.set("q", q);
        else url.searchParams.delete("q");
        window.history.replaceState(null, "", url.toString());
      } catch (e) {}
    };

    archiveInput.addEventListener("input", function () {
      applyArchiveFilter(archiveInput.value);
    });

    var archiveInitialQ = null;
    try {
      archiveInitialQ = new URLSearchParams(window.location.search).get("q");
    } catch (e) {}
    if (archiveInitialQ) {
      archiveInput.value = archiveInitialQ;
      applyArchiveFilter(archiveInitialQ);
    }
  }

  /* ------------------------------ 内置搜索页 ---------------------------- */
  var searchPanel = document.getElementById("search-panel");
  if (searchPanel) {
    var searchInput = document.getElementById("search-input");
    var searchResults = document.getElementById("search-results");
    var searchStatus = document.getElementById("search-status");
    var searchEndpoint =
      searchPanel.getAttribute("data-endpoint") ||
      "/apis/api.content.halo.run/v1alpha1/posts";
    var searchSize = searchPanel.getAttribute("data-size") || "200";
    var searchMsgHint = searchPanel.getAttribute("data-msg-hint") || "";
    var searchMsgEmpty = searchPanel.getAttribute("data-msg-empty") || "";
    var searchMsgLoading = searchPanel.getAttribute("data-msg-loading") || "";
    var searchMsgResults = searchPanel.getAttribute("data-msg-results") || "%1";
    var searchMsgFailed = searchPanel.getAttribute("data-msg-failed") || "";
    var searchIndex = null;
    var searchLoading = false;

    var runSearch = function (raw) {
      if (!searchIndex) return;
      var q = (raw || "").trim().toLowerCase();
      searchResults.innerHTML = "";
      if (!q) {
        if (searchStatus) searchStatus.textContent = searchMsgHint;
        return;
      }
      var hits = searchIndex.filter(function (it) {
        return it.haystack.indexOf(q) !== -1;
      });
      if (searchStatus) {
        searchStatus.textContent = searchMsgResults.replace("%1", hits.length);
      }
      if (hits.length === 0) {
        var none = document.createElement("li");
        none.className = "search-empty";
        none.textContent = searchMsgEmpty;
        searchResults.appendChild(none);
        return;
      }
      hits.slice(0, 50).forEach(function (it) {
        var li = document.createElement("li");
        li.className = "search-result";

        var a = document.createElement("a");
        a.className = "search-result-title";
        a.href = it.url;
        a.textContent = it.title;
        li.appendChild(a);

        if (it.excerpt) {
          var p = document.createElement("p");
          p.className = "search-result-excerpt";
          p.textContent = it.excerpt;
          li.appendChild(p);
        }

        var meta = document.createElement("div");
        meta.className = "search-result-meta";
        if (it.date) {
          var t = document.createElement("time");
          t.textContent = it.date.slice(0, 10);
          meta.appendChild(t);
        }
        it.chips.forEach(function (name) {
          var chip = document.createElement("span");
          chip.className = "search-result-chip";
          chip.textContent = name;
          meta.appendChild(chip);
        });
        li.appendChild(meta);
        searchResults.appendChild(li);
      });
    };

    // 公开内容接口只返回标题/摘要/分类/标签, 不含正文 —— 所以是「摘要级」搜索。
    var loadSearchIndex = function () {
      if (searchIndex || searchLoading) return;
      searchLoading = true;
      if (searchStatus) searchStatus.textContent = searchMsgLoading;
      fetch(searchEndpoint + "?page=0&size=" + encodeURIComponent(searchSize), {
        headers: { Accept: "application/json" },
      })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          searchIndex = (data.items || []).map(function (p) {
            var catNames = (p.categories || [])
              .map(function (c) {
                return (c.spec && c.spec.displayName) || "";
              })
              .filter(Boolean);
            var tagNames = (p.tags || [])
              .map(function (t) {
                return (t.spec && t.spec.displayName) || "";
              })
              .filter(Boolean);
            var titleText = (p.spec && p.spec.title) || "";
            var excerpt =
              (p.status && p.status.excerpt) ||
              (p.spec && p.spec.excerpt && p.spec.excerpt.raw) ||
              "";
            return {
              title: titleText,
              url: (p.status && p.status.permalink) || "#",
              date: (p.spec && p.spec.publishTime) || "",
              excerpt: excerpt,
              chips: catNames.concat(tagNames),
              haystack: [titleText, excerpt, catNames.join(" "), tagNames.join(" ")]
                .join(" ")
                .toLowerCase(),
            };
          });
          if (searchStatus) searchStatus.textContent = searchMsgHint;
          if (searchInput && searchInput.value.trim()) runSearch(searchInput.value);
        })
        .catch(function () {
          if (searchStatus) searchStatus.textContent = searchMsgFailed;
        })
        .then(function () {
          searchLoading = false;
        });
    };

    searchInput.addEventListener("input", function () {
      runSearch(searchInput.value);
    });

    var searchInitialQ = null;
    try {
      searchInitialQ = new URLSearchParams(window.location.search).get("q");
    } catch (e) {}
    if (searchInitialQ) searchInput.value = searchInitialQ;

    loadSearchIndex();
  }
})();
