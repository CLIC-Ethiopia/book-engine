// app.js — Main application bootstrap
// Loads books from webui/data/books-index.json, then loads each book's data on demand

class DashboardApp {
  constructor() {
    this.bookIndex = null;
    this.currentBook = null;
    this.currentBookSlug = null;
    this.currentPageIndex = 0;
    this.editedContent = {};
    this.chatHistory = [];
  }

  async init() {
    // Load book index
    await this.loadBookIndex();

    // Initialize UI
    this.renderBookList();
    this.updateQuickStats();
    this.bindEvents();

    // Auto-select first book if available
    if (this.bookIndex?.books?.length > 0) {
      await this.selectBook(this.bookIndex.books[0].slug);
    } else {
      this.showEmptyState();
    }

    this.initChatBridge();
    this.initFloatingNav();
    this.initLLMConfigModal();
  }



  // ============================================================
  // Book Index Loading
  // ============================================================

  async loadBookIndex() {
    try {
      const indexUrl = "./data/books-index.json";
      console.log("Fetching book index from:", indexUrl);
      const response = await fetch(indexUrl);
      console.log("Book index response:", response.status, response.statusText);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      this.bookIndex = await response.json();
      console.log(`Loaded book index with ${this.bookIndex.books?.length || 0} books:`, this.bookIndex.books?.map(b => b.slug));
    } catch (e) {
      console.error("Failed to load book index:", e);
      this.bookIndex = { generatedAt: new Date().toISOString(), books: [] };
    }
  }

  // ============================================================
  // Book Loading (on demand when selected)
  // ============================================================

  async selectBook(slug) {
    // Update active state in sidebar
    document.querySelectorAll("#book-list li").forEach(li => {
      li.classList.toggle("active", li.dataset.slug === slug);
    });

    if (this.currentBookSlug === slug && this.currentBook) {
      return; // Already loaded
    }

    this.currentBookSlug = slug;
    this.currentPageIndex = 0;
    this.viewFullBook = true; // Track full book view mode

    try {
      console.log(`Loading book: ${slug}`);
      
      // Load book.json
      const bookJsonUrl = `../../books/${slug}/book.json`;
      console.log("Fetching book.json from:", bookJsonUrl);
      const bookJsonResponse = await fetch(bookJsonUrl);
      console.log("book.json response:", bookJsonResponse.status, bookJsonResponse.statusText);
      if (!bookJsonResponse.ok) throw new Error(`Failed to load book.json for ${slug}: HTTP ${bookJsonResponse.status}`);
      const bookJson = await bookJsonResponse.json();

      // Try to load the full generated book.html first
      let hasFullBook = false;
      let fullBookHtml = "";
      let pages = [];
      try {
        const bookHtmlUrl = `../../books/${slug}/book.html`;
        console.log("Fetching book.html from:", bookHtmlUrl);
        const bookHtmlResponse = await fetch(bookHtmlUrl);
        console.log("book.html response:", bookHtmlResponse.status, bookHtmlResponse.statusText);
        if (bookHtmlResponse.ok) {
          fullBookHtml = await bookHtmlResponse.text();
          hasFullBook = true;
          console.log("Full book.html loaded successfully");
          // Parse ALL pages from full book.html (cover, TOC, content, index, back cover)
          pages = this.parsePagesFromFullBook(fullBookHtml, bookJson);
        } else {
          console.log("book.html not found, will use fallback");
        }
      } catch (e) {
        console.log("book.html fetch error:", e);
      }

      // If no full book, fall back to interior file
      if (!hasFullBook) {
        const interiorUrl = `../../books/${slug}/${slug}.html`;
        console.log("Fetching interior from:", interiorUrl);
        const interiorResponse = await fetch(interiorUrl);
        console.log("interior response:", interiorResponse.status, interiorResponse.statusText);
        if (!interiorResponse.ok) throw new Error(`Failed to load ${slug}.html: HTTP ${interiorResponse.status}`);
        const interiorHtml = await interiorResponse.text();
        pages = this.parsePagesFromInterior(interiorHtml, bookJson);
        console.log(`Parsed ${pages.length} pages from interior`);
      } else {
        console.log(`Parsed ${pages.length} pages from full book.html`);
      }

      this.currentBook = {
        slug,
        ...bookJson,
        pages,
        hasFullBook,
        fullBookHtml,
      };

      // Select first page
      this.selectPage(0);
      this.updateBuildButtonVisibility();
    } catch (e) {
      console.error(`Failed to load book ${slug}:`, e);
      this.showErrorState(`Failed to load book: ${e.message}`);
    }
  }

  // Parse all pages from full book.html (cover, TOC, content pages, index, back cover)
  parsePagesFromFullBook(html, bookJson) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find all sheet sections (each page is a section.sheet)
    const sheets = doc.querySelectorAll("section.sheet");
    const pages = [];

    sheets.forEach((sheet, index) => {
      // Get page identifier
      const titleEl = sheet.querySelector("h1.title") || sheet.querySelector("h2.title");
      const subEl = sheet.querySelector(".sub");
      const explainEl = sheet.querySelector(".explain");
      const askEl = sheet.querySelector(".ask");
      const pillEl = sheet.querySelector(".pill");
      const photoEl = sheet.querySelector(".photo img");
      const diagramEl = sheet.querySelector(".diagram");
      const isCover = sheet.classList.contains("cover");
      const isBackCover = sheet.classList.contains("back-cover");
      const isTOC = sheet.classList.contains("toc") || sheet.querySelector(".toc-title");

      let title = titleEl?.textContent?.trim() || `Page ${index + 1}`;
      if (isCover) title = "Cover";
      if (isBackCover) title = "Back Cover";
      if (isTOC) title = "Table of Contents";

      const sub = subEl?.textContent?.trim() || "";
      const explain = explainEl?.innerHTML?.trim() || "";
      const action = askEl?.querySelector("p")?.textContent?.trim() || askEl?.textContent?.trim() || "";
      const category = pillEl?.textContent?.trim() || (isCover ? "Cover" : (isBackCover ? "Back Cover" : (isTOC ? "Contents" : "General")));
      const type = photoEl ? "photo" : (diagramEl ? "diagram" : "photo");

      pages.push({
        title,
        sub,
        explain,
        action,
        category,
        type,
        isCover,
        isBackCover,
        isTOC,
        index,
      });
    });

    // If no sheets found, fall back to book.json parts
    if (pages.length === 0 && bookJson.parts) {
      bookJson.parts.forEach(part => {
        if (part.blocks && Array.isArray(part.blocks)) {
          part.blocks.forEach((blockTitle, i) => {
            pages.push({
              title: blockTitle,
              sub: "",
              explain: "",
              action: "",
              category: part.eyebrow || "General",
              type: "photo",
              partEyebrow: part.eyebrow || "",
              index: pages.length,
            });
          });
        }
      });
    }

    return pages;
  }

  parsePagesFromInterior(html, bookJson) {
    // Create a temporary DOM to parse the interior HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find all sheet sections
    const sheets = doc.querySelectorAll("section.sheet.bb");
    const pages = [];

    sheets.forEach((sheet, index) => {
      const titleEl = sheet.querySelector("h1.title");
      const subEl = sheet.querySelector(".sub");
      const explainEl = sheet.querySelector(".explain");
      const askEl = sheet.querySelector(".ask");
      const eyebrowEl = sheet.querySelector(".eyebrow");
      const pillEl = sheet.querySelector(".pill");
      const photoEl = sheet.querySelector(".photo img");
      const diagramEl = sheet.querySelector(".diagram");

      const title = titleEl?.textContent?.trim() || `Page ${index + 1}`;
      const sub = subEl?.textContent?.trim() || "";
      const explain = explainEl?.innerHTML?.trim() || "";
      const action = askEl?.querySelector("p")?.textContent?.trim() || askEl?.textContent?.trim() || "";
      const category = pillEl?.textContent?.trim() || "General";
      const type = photoEl ? "photo" : (diagramEl ? "diagram" : "photo");

      // Try to get category from bookJson parts
      let partEyebrow = "";
      if (bookJson.parts && Array.isArray(bookJson.parts)) {
        for (const part of bookJson.parts) {
          if (part.blocks && part.blocks.includes(title)) {
            partEyebrow = part.eyebrow || "";
            break;
          }
        }
      }

      pages.push({
        title,
        sub,
        explain,
        action,
        category,
        type,
        partEyebrow,
        index,
      });
    });

    // If no sheets found, fall back to book.json parts
    if (pages.length === 0 && bookJson.parts) {
      bookJson.parts.forEach(part => {
        if (part.blocks && Array.isArray(part.blocks)) {
          part.blocks.forEach((blockTitle, i) => {
            pages.push({
              title: blockTitle,
              sub: "",
              explain: "",
              action: "",
              category: part.eyebrow || "General",
              type: "photo",
              partEyebrow: part.eyebrow || "",
              index: pages.length,
            });
          });
        }
      });
    }

    return pages;
  }

  // ============================================================
  // Sidebar Rendering
  // ============================================================

  renderBookList() {
    const list = document.getElementById("book-list");
    if (!list || !this.bookIndex?.books) {
      console.error("renderBookList: missing list or books", { list: !!list, books: this.bookIndex?.books?.length });
      return;
    }

    console.log("renderBookList: rendering", this.bookIndex.books.length, "books");
    list.innerHTML = "";

    this.bookIndex.books.forEach((book, index) => {
      const li = document.createElement("li");
      li.className = index === 0 ? "active" : "";
      li.dataset.slug = book.slug;
      li.innerHTML = `
        <div class="book-title-row">
          <span class="book-status-indicator" style="background:${book.status === 'ready' ? '#14b8a6' : '#f59e0b'}"></span>
          <span class="book-title-text">${book.title}</span>
        </div>
        <div class="book-meta-line">
          <span>${book.pageCount} pages</span>
          <span>${book.status}</span>
        </div>
      `;
      li.addEventListener("click", () => this.selectBook(book.slug));
      list.appendChild(li);
    });
    console.log("renderBookList: done, list children:", list.children.length);
  }

  updateQuickStats() {
    const booksCount = document.getElementById("books-count");
    const pagesCount = document.getElementById("pages-count");
    if (booksCount && this.bookIndex) {
      booksCount.textContent = this.bookIndex.books.length;
    }
    if (pagesCount && this.currentBook) {
      pagesCount.textContent = this.currentBook.pages.length;
    }
  }

  showEmptyState() {
    const iframe = document.getElementById("page-iframe");
    if (iframe) {
      iframe.srcdoc = `
        <!doctype html>
        <html lang="en"><head><meta charset="utf-8">
        <link rel="stylesheet" href="../engine/sheet.css">
        <link rel="stylesheet" href="../engine/sizes/b5.css">
        <link rel="stylesheet" href="../engine/themes/studio.css"></head>
        <body><main class="deck"><section class="sheet bb">
        <h1 class="title">No Books Found</h1>
        <div class="sub">Run <code>node engine/tools/list-books.mjs</code> to scan the books folder.</div>
        </section></main></body></html>
      `;
    }
  }

  showErrorState(message) {
    const iframe = document.getElementById("page-iframe");
    if (iframe) {
      iframe.srcdoc = `
        <!doctype html>
        <html lang="en"><head><meta charset="utf-8">
        <link rel="stylesheet" href="../engine/sheet.css">
        <link rel="stylesheet" href="../engine/sizes/b5.css">
        <link rel="stylesheet" href="../engine/themes/studio.css"></head>
        <body><main class="deck"><section class="sheet bb">
        <h1 class="title">Error</h1>
        <div class="sub" style="color:#ef4444">${message}</div>
        </section></main></body></html>
      `;
    }
  }

  // ============================================================
  // Page Selection and Preview
  // ============================================================

  selectPage(index) {
    if (!this.currentBook || index < 0 || index >= this.currentBook.pages.length) return;
    this.currentPageIndex = index;
    const page = this.currentBook.pages[index];
    this.renderIframe(page);
    this.populateEditor(page);
    this.updateHeroPageInfo();
    this.updateCheckStatus("—");
    
    // Scroll iframe to top after content loads
    this.scrollIframeToTop();
  }

  // Scroll iframe to top after content loads
  scrollIframeToTop() {
    const iframe = document.getElementById("page-iframe");
    if (!iframe) return;
    
    // Use onload to ensure content is loaded before scrolling
    const scrollToTop = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.scrollTo(0, 0);
      }
      // Also scroll main window to top
      window.scrollTo(0, 0);
      
      // Remove the one-time listener
      iframe.removeEventListener("load", scrollToTop);
    };
    
    // If iframe is already loaded, scroll immediately
    if (iframe.srcdoc) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.scrollTo(0, 0);
        }
        window.scrollTo(0, 0);
      }, 0);
    }
    
    // Also listen for future loads
    iframe.addEventListener("load", scrollToTop, { once: true });
  }

  getPageDataByTitle(title) {
    return this.currentBook?.pages?.find(p => p.title === title);
  }

  renderIframe(page) {
    const iframe = document.getElementById("page-iframe");
    if (!iframe || !this.currentBook) return;

    console.log("Rendering iframe for page:", page.title, "viewFullBook:", this.viewFullBook, "hasFullBook:", this.currentBook.hasFullBook);

    if (!this.currentBook.hasFullBook || !this.currentBook.fullBookHtml) {
      // Fallback to single page preview if no full book
      this.renderSinglePageFallback(page, iframe);
      return;
    }

    // Always use full book.html
    // In single-page mode, inject CSS to hide all pages except current
    let html = this.currentBook.fullBookHtml;

    // ADD BASE TAG HERE - to make sure photos appear in iframe of webui
    const baseHref = `../../books/${this.currentBook.slug}/`;
    html = html.replace('<head>', `<head><base href="${baseHref}">`);


    if (!this.viewFullBook) {
      // Single page mode: inject CSS to show only current page
      const hideOtherPagesCss = `
        <style id="single-page-filter">
          section.sheet { display: none !important; }
          section.sheet:nth-of-type(${this.currentPageIndex + 1}) { display: block !important; }
        </style>
      `;
      // Inject before </head>
      html = html.replace('</head>', hideOtherPagesCss + '</head>');
    }

    iframe.srcdoc = html;
  }

  renderSinglePageFallback(page, iframe) {
    const isPhoto = page.type === "photo";
    const placeholderImageUrl = `../../books/${this.currentBook.slug}/images/${page.title.toLowerCase().replace(/ /g, '-')}.jpg`;
    const placeholderDiagramSvg = `
      <svg width="100%" viewBox="0 0 592 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Placeholder diagram">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Inter,sans-serif" font-size="16" fill="#64748b">
          Diagram placeholder
        </text>
      </svg>
    `;

    const iframeDoc = `
      <!doctype html>
      <html lang="en" data-size="b5">
      <head>
        <meta charset="utf-8">
        <link rel="stylesheet" href="../../engine/sheet.css">
        <link rel="stylesheet" href="../../engine/sizes/b5.css">
        <link rel="stylesheet" href="../../engine/themes/studio.css">
      </head>
      <body>
        <main class="deck">
          <section class="sheet bb">
            <h2 class="sr">${page.title}: a concept page preview</h2>
            <div class="tab"></div>
            <div class="top">
              <div class="eyebrow"><b>${this.currentBook.series}</b></div>
              <span class="pill">${page.category}</span>
            </div>
            <h1 class="title">${page.title}</h1>
            <div class="sub">${page.sub}</div>
            <hr class="rule">
            ${isPhoto ? `
              <figure class="photo">
                <img src="${placeholderImageUrl}" alt="${page.title}">
              </figure>
            ` : `
              <div class="diagram">
                ${placeholderDiagramSvg}
              </div>
            `}
            <hr class="rule">
            <div class="explain">
              <div>${page.explain}</div>
            </div>
            <div class="ask">
              <span class="lbl">TRY THIS TONIGHT</span>
              <p>${page.action}</p>
            </div>
            <div class="foot">
              <span class="brand">${this.currentBook.brand}</span>
              <span class="pg"></span>
              <span class="series">${this.currentBook.series}</span>
            </div>
          </section>
        </main>
        <script src="../../engine/sheet-tools.js"><\/script>
      </body>
      </html>
    `;

    iframe.srcdoc = iframeDoc;
  }


  scrollToPageInIframe(pageIndex) {
    const iframe = document.getElementById('page-iframe');
    if (!iframe?.contentWindow) return;
    
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const pageEl = doc.querySelectorAll('section.sheet')[pageIndex];
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) {
      console.warn('Could not scroll to page:', e);
    }
  }

  // Mock "Run Check" — returns fixture result
  runCheck() {
    this.updateCheckStatus("0 mm overflow — page fits (mock)");
  }

  updateCheckStatus(text) {
    const status = document.getElementById("check-status");
    if (status) {
      status.textContent = text;
      status.style.color = text.includes("0 mm") ? "#10b981" : "#ef4444";
    }
  }

  // Mock "Take Screenshot" — shows placeholder
  takeScreenshot() {
    const img = document.getElementById("screenshot-img");
    if (!img) return;
    img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/8+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    img.style.display = "block";
    setTimeout(() => {
      img.alt = `Screenshot of ${this.currentBook?.pages[this.currentPageIndex]?.title || "page"}`;
    }, 300);
  }

  // Build book — runs build-book.mjs via API (mock for now)
  async buildBook() {
    const buildBtn = document.getElementById("build-book");
    if (!buildBtn || !this.currentBook) return;

    buildBtn.textContent = "Building...";
    buildBtn.disabled = true;

    try {
      // In a real implementation, this would call a backend API that runs:
      // node engine/tools/build-book.mjs books/${this.currentBook.slug}
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Reload the book to get the new book.html
      const bookHtmlResponse = await fetch(`../../books/${this.currentBook.slug}/book.html`);
      if (bookHtmlResponse.ok) {
        const fullBookHtml = await bookHtmlResponse.text();
        this.currentBook.hasFullBook = true;
        this.currentBook.fullBookHtml = fullBookHtml;
        this.updateBuildButtonVisibility();
        this.renderIframe(this.currentBook.pages[this.currentPageIndex]);
        buildBtn.textContent = "Built!";
        setTimeout(() => {
          buildBtn.textContent = "Build Book";
        }, 2000);
      } else {
        throw new Error("Build completed but book.html not found");
      }
    } catch (e) {
      console.error("Build failed:", e);
      buildBtn.textContent = "Build Failed";
      setTimeout(() => {
        buildBtn.textContent = "Build Book";
        buildBtn.disabled = false;
      }, 3000);
    }
  }

  updateBuildButtonVisibility() {
    const buildBtn = document.getElementById("build-book");
    const viewFullBtn = document.getElementById("view-full-book");
    if (!buildBtn || !this.currentBook) return;

    if (this.currentBook.hasFullBook) {
      buildBtn.style.display = "none";
      viewFullBtn.style.display = "inline-flex";
      viewFullBtn.textContent = this.viewFullBook ? "Single Page" : "View Full Book";
      this.styleViewFullButton();
    } else {
      buildBtn.style.display = "inline-flex";
      buildBtn.disabled = false;
      buildBtn.textContent = "Build Book";
      viewFullBtn.style.display = "none";
    }
  }

  // Style the View Full Book / Single Page button with bold text and good colors
  styleViewFullButton() {
    const viewFullBtn = document.getElementById("view-full-book");
    if (!viewFullBtn) return;

    if (this.viewFullBook) {
      // Currently in Full Book view - show "Single Page"
      viewFullBtn.textContent = "Single Page";
      viewFullBtn.style.background = "var(--color-warning)";
      viewFullBtn.style.color = "var(--text-on-warning)";
      viewFullBtn.style.fontWeight = "700";
      viewFullBtn.style.border = "none";
      viewFullBtn.style.boxShadow = "var(--shadow-md)";
    } else {
      // Currently in Single Page view - show "View Full Book"
      viewFullBtn.textContent = "View Full Book";
      viewFullBtn.style.background = "var(--color-primary)";
      viewFullBtn.style.color = "var(--text-on-primary)";
      viewFullBtn.style.fontWeight = "700";
      viewFullBtn.style.border = "none";
      viewFullBtn.style.boxShadow = "var(--shadow-md)";
    }
    // Common styles for both states
    viewFullBtn.style.fontWeight = "700";
    viewFullBtn.style.transition = "all var(--transition-fast)";
    viewFullBtn.style.border = "none";
  }

  toggleFullBookView() {
    this.viewFullBook = !this.viewFullBook;
    this.updateBuildButtonVisibility();
    this.renderIframe(this.currentBook.pages[this.currentPageIndex]);
  }

  // ============================================================
  // Hero Page Info Update
  // ============================================================

  updateHeroPageInfo() {
    const page = this.currentBook?.pages[this.currentPageIndex];
    const pageNumEl = document.getElementById("page-number");
    const pageTitleEl = document.getElementById("page-title");
    const bookTitleEl = document.getElementById("book-title");
    const seriesEl = document.getElementById("series-label");
    if (pageNumEl) pageNumEl.textContent = `${this.currentPageIndex + 1} / ${this.currentBook?.pages.length || 0}`;
    if (pageTitleEl) pageTitleEl.textContent = page?.title || "";
    if (bookTitleEl) bookTitleEl.textContent = this.currentBook?.title || "";
    if (seriesEl) seriesEl.textContent = this.currentBook?.series || "";

    this.updateFloatingPageNumber();  // ADD THIS LINE
    //this.updateFloatingPageNumber();  // Updates floating nav
  }

  // ============================================================
  // Editor
  // ============================================================

  populateEditor(page) {
    this.editedContent = {
      title: page.title,
      sub: page.sub,
      explain: page.explain,
      action: page.action
    };
    this.syncEditorToDOM();
    this.updateSaveButton();
  }

  syncEditorToDOM() {
    const titleEl = document.getElementById("editor-title");
    const subEl = document.getElementById("editor-subtitle");
    const explainEl = document.getElementById("editor-explain");
    const actionEl = document.getElementById("editor-action");

    if (titleEl) titleEl.value = this.editedContent.title;
    if (subEl) subEl.value = this.editedContent.sub;
    if (explainEl) explainEl.value = this.editedContent.explain;
    if (actionEl) actionEl.value = this.editedContent.action;
  }

  updateSaveButton() {
    const saveBtn = document.getElementById("save-edit");
    if (saveBtn) saveBtn.disabled = false;
  }

  saveChanges() {
    if (!this.currentBook) return;
    const page = this.currentBook.pages[this.currentPageIndex];
    // Update local page data
    page.title = this.editedContent.title;
    page.sub = this.editedContent.sub;
    page.explain = this.editedContent.explain;
    page.action = this.editedContent.action;

    // Re-render iframe with new content
    this.renderIframe(page);
    this.updateHeroPageInfo();

    // Visual feedback
    const saveBtn = document.getElementById("save-edit");
    if (saveBtn) {
      saveBtn.textContent = "Saved!";
      setTimeout(() => {
        saveBtn.textContent = "Save Changes";
      }, 1500);
    }
  }

  // ============================================================
  // AI Chat - File Bridge Client
  // ============================================================

  initChatBridge() {
    this.chatInput = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("send-chat");
    this.historyEl = document.getElementById("chat-history");

    // Modal elements
    this.modal = document.getElementById("chat-modal");
    this.modalInput = document.getElementById("chat-modal-input");
    this.modalSendBtn = document.getElementById("chat-modal-send");
    this.modalHistoryEl = document.getElementById("chat-modal-history");
    this.modalCloseBtn = document.getElementById("chat-modal-close");
    this.modalBackdrop = document.getElementById("chat-modal-backdrop");
    this.maximizeBtn = document.getElementById("maximize-chat");

    if (this.sendBtn) {
      this.sendBtn.addEventListener("click", () => this.sendChatMessage());
    }
    if (this.chatInput) {
      this.chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.sendChatMessage();
        }
      });
    }

    // Modal event listeners
    if (this.maximizeBtn) {
      this.maximizeBtn.addEventListener("click", () => this.openChatModal());
    }
    if (this.modalCloseBtn) {
      this.modalCloseBtn.addEventListener("click", () => this.closeChatModal());
    }
    if (this.modalBackdrop) {
      this.modalBackdrop.addEventListener("click", () => this.closeChatModal());
    }
    if (this.modalSendBtn) {
      this.modalSendBtn.addEventListener("click", () => this.sendChatMessageFromModal());
    }
    if (this.modalInput) {
      this.modalInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.sendChatMessageFromModal();
        }
      });
    }

    // Quick actions - inline (scoped so modal buttons don't double-bind)
    document.querySelectorAll("#quick-actions .quick-action").forEach(btn => {
      btn.addEventListener("click", () => {
        this.chatInput.value = btn.dataset.prompt;
        this.sendChatMessage();
      });
    });

    // Quick actions - modal
    document.querySelectorAll("#chat-modal-quick-actions .quick-action").forEach(btn => {
      btn.addEventListener("click", () => {
        this.modalInput.value = btn.dataset.prompt;
        this.sendChatMessageFromModal();
      });
    });

    // ESC key to close modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.modal?.style.display === "flex") {
        this.closeChatModal();
      }
    });

    // Initialize chat history
    this.initChatHistory();
  }

  initChatHistory() {
    const historyEl = document.getElementById("chat-history");
    if (historyEl) {
      historyEl.innerHTML = "";
      const welcome = document.createElement("div");
      welcome.className = "ai-msg";
      welcome.innerHTML = "<strong>AI:</strong> I'm your book-engine assistant to help you compose an entire book. Ask me anything about your book!";
      historyEl.appendChild(welcome);
    }
    // Also initialize modal history
    const modalHistoryEl = document.getElementById("chat-modal-history");
    if (modalHistoryEl) {
      modalHistoryEl.innerHTML = "";
      const welcome = document.createElement("div");
      welcome.className = "ai-msg";
      welcome.innerHTML = "<strong>AI:</strong> I'm your book-engine assistant to help you compose an entire book. Ask me anything about your book!";
      modalHistoryEl.appendChild(welcome);
    }
  }

  initLLMConfigModal() {
    this.llmConfigModal = document.getElementById("llm-config-modal");
    this.llmConfigModalCloseBtn = document.getElementById("llm-config-modal-close");
    this.llmConfigModalBackdrop = document.getElementById("llm-config-modal-backdrop");
    this.llmConfigModalCancelBtn = document.getElementById("llm-config-cancel-btn");
    this.llmConfigModalSaveBtn = document.getElementById("llm-config-save-btn");
    this.llmConfigTabs = document.querySelectorAll(".llm-config-tab");
    this.llmConfigTabPanels = document.querySelectorAll(".llm-config-tab-panel");

    // LLM config button in menu bar
    const llmConfigBtn = document.getElementById("llm-config-btn");
    if (llmConfigBtn) {
      llmConfigBtn.addEventListener("click", () => this.openLLMConfigModal());
    }

    // Modal close events
    if (this.llmConfigModalCloseBtn) {
      this.llmConfigModalCloseBtn.addEventListener("click", () => this.closeLLMConfigModal());
    }
    if (this.llmConfigModalBackdrop) {
      this.llmConfigModalBackdrop.addEventListener("click", () => this.closeLLMConfigModal());
    }
    if (this.llmConfigModalCancelBtn) {
      this.llmConfigModalCancelBtn.addEventListener("click", () => this.closeLLMConfigModal());
    }
    if (this.llmConfigModalSaveBtn) {
      this.llmConfigModalSaveBtn.addEventListener("click", () => this.saveLLMConfig());
    }

    // Tab switching
    this.llmConfigTabs.forEach(tab => {
      tab.addEventListener("click", () => this.switchLLMConfigTab(tab.dataset.tab));
    });

    // ESC key to close modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.llmConfigModal?.classList.contains("visible")) {
        this.closeLLMConfigModal();
      }
    });

    // Populate CLI agents from bridge config
    this.populateCLIAgentList();

    // Populate API provider models
    this.updateAPIModels();
  }

  // Populate CLI Agents list from bridge-config.json
  async populateCLIAgentList() {
    try {
      // Bridge config is at engine/tools/bridge-config.json, accessible via static server
      const response = await fetch("/engine/tools/bridge-config.json");
      if (!response.ok) return;
      const config = await response.json();
      
      const listEl = document.getElementById("cli-provider-list");
      if (!listEl) return;

      const agents = Object.entries(config.clients || {}).map(([id, config]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        command: config.command,
        args: config.args?.join(" ") || "",
        status: "available" // Could check if binary exists
      }));

      if (agents.length === 0) {
        listEl.innerHTML = '<p class="llm-empty-state">No CLI agents configured</p>';
        return;
      }

      listEl.innerHTML = agents.map(agent => `
        <div class="llm-provider-item" data-id="${agent.id}">
          <div class="llm-provider-info">
            <span class="llm-provider-name">${agent.name}</span>
            <span class="llm-provider-meta">${agent.command} ${agent.args}</span>
          </div>
          <span class="llm-provider-status ${agent.status}">${agent.status}</span>
        </div>
      `).join("");
    } catch (e) {
      console.error("Failed to load CLI agents:", e);
    }
  }

  // Update API model dropdown based on selected provider
  updateAPIModels() {
    const providerSelect = document.getElementById("api-provider-select");
    const modelSelect = document.getElementById("api-model-select");
    const baseUrlGroup = document.getElementById("api-base-url-group");
    
    if (!providerSelect || !modelSelect) return;

    const models = {
      gemini: [
        { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
        { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
        { value: "gemini-1.0-pro", label: "Gemini 1.0 Pro" }
      ],
      openai: [
        { value: "gpt-4o", label: "GPT-4o" },
        { value: "gpt-4o-mini", label: "GPT-4o Mini" },
        { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
        { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
      ],
      anthropic: [
        { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
        { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
        { value: "claude-3-opus-20240229", label: "Claude 3 Opus" }
      ],
      openrouter: [
        { value: "openrouter/auto", label: "Auto (Best Model)" },
        { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
        { value: "openai/gpt-4o", label: "GPT-4o" },
        { value: "google/gemini-pro-1.5", label: "Gemini 1.5 Pro" },
        { value: "meta-llama/llama-3.1-405b", label: "Llama 3.1 405B" },
        { value: "mistralai/mistral-large", label: "Mistral Large" }
      ],
      ollama: [
        { value: "llama3.1:8b", label: "Llama 3.1 8B" },
        { value: "llama3.1:70b", label: "Llama 3.1 70B" },
        { value: "mistral:7b", label: "Mistral 7B" },
        { value: "codellama:13b", label: "CodeLlama 13B" },
        { value: "phi3:14b", label: "Phi-3 14B" },
        { value: "gemma2:9b", label: "Gemma 2 9B" }
      ],
      lmstudio: [
        { value: "lmstudio-auto", label: "Auto (Loaded Model)" }
      ],
      custom: []
    };

    const provider = providerSelect.value;
    const modelList = models[provider] || [];

    // Show/hide base URL for custom and ollama/lmstudio
    if (baseUrlGroup) {
      baseUrlGroup.style.display = ["custom", "ollama", "lmstudio"].includes(provider) ? "block" : "none";
    }

    modelSelect.innerHTML = '<option value="">Select model...</option>' +
      modelList.map(m => `<option value="${m.value}">${m.label}</option>`).join("");
  }

  openLLMConfigModal() {
    if (this.llmConfigModal) {
      this.llmConfigModal.classList.add("visible", "opening");
      setTimeout(() => this.llmConfigModal.classList.remove("opening"), 300);
    }
  }

  closeLLMConfigModal() {
    if (this.llmConfigModal) {
      this.llmConfigModal.classList.add("closing");
      this.llmConfigModal.classList.remove("visible");
      setTimeout(() => {
        this.llmConfigModal.classList.remove("closing");
      }, 200);
    }
  }

  switchLLMConfigTab(tabName) {
    this.llmConfigTabs.forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
      tab.setAttribute("aria-selected", tab.dataset.tab === tabName);
    });
    this.llmConfigTabPanels.forEach(panel => {
      panel.classList.toggle("active", panel.id === `tab-${tabName}`);
    });
  }

  saveLLMConfig() {
    // TODO: Implement config saving
    console.log("Save LLM config");
    this.closeLLMConfigModal();
  }

  openChatModal() {
    if (this.modal) {
      this.modal.style.display = "flex";
      this.modal.classList.add("opening");
      setTimeout(() => this.modal.classList.remove("opening"), 300);
      // Focus the modal input
      if (this.modalInput) this.modalInput.focus();
      // Sync history to modal
      this.syncHistoryToModal();
    }
  }

  closeChatModal() {
    if (this.modal) {
      this.modal.classList.add("closing");
      setTimeout(() => {
        this.modal.style.display = "none";
        this.modal.classList.remove("closing");
      }, 200);
    }
  }

  syncHistoryToModal() {
    if (!this.modalHistoryEl || !this.historyEl) return;
    // Clone messages from inline to modal
    this.modalHistoryEl.innerHTML = "";
    const messages = this.historyEl.querySelectorAll(".user-msg, .ai-msg");
    messages.forEach(msg => {
      const clone = msg.cloneNode(true);
      this.modalHistoryEl.appendChild(clone);
    });
    this.modalHistoryEl.scrollTop = this.modalHistoryEl.scrollHeight;
  }

  syncHistoryFromModal() {
    if (!this.modalHistoryEl || !this.historyEl) return;
    // Clone messages from modal to inline
    this.historyEl.innerHTML = "";
    const messages = this.modalHistoryEl.querySelectorAll(".user-msg, .ai-msg");
    messages.forEach(msg => {
      const clone = msg.cloneNode(true);
      this.historyEl.appendChild(clone);
    });
    this.historyEl.scrollTop = this.historyEl.scrollHeight;
  }

  // Highlight code blocks in a message element
  highlightCodeBlocks(element) {
    if (typeof hljs !== "undefined") {
      element.querySelectorAll("pre code").forEach(block => {
        hljs.highlightElement(block);
      });
    }
  }

  addMessage(role, content) {
    const historyEl = document.getElementById("chat-history");
    if (!historyEl) return;

    const msg = document.createElement("div");
    msg.className = `${role}-msg`;
    
    // Parse markdown for AI messages only
    const displayContent = role === "ai" ? this.parseMarkdown(content) : content;
    msg.innerHTML = `<strong>${role === "user" ? "You" : "AI"}:</strong> ${displayContent}`;
    historyEl.appendChild(msg);
    historyEl.scrollTop = historyEl.scrollHeight;

    // Highlight code blocks in main chat
    this.highlightCodeBlocks(msg);

    // Also add to modal if open
    if (this.modal?.style.display === "flex" && this.modalHistoryEl) {
      const modalMsg = msg.cloneNode(true);
      this.modalHistoryEl.appendChild(modalMsg);
      this.modalHistoryEl.scrollTop = this.modalHistoryEl.scrollHeight;
      // Highlight code blocks in modal
      this.highlightCodeBlocks(modalMsg);
    }
    return Date.now();
  }

  removeLastThinkingMessage() {
    // Remove from main chat
    if (this.historyEl) {
      const messages = this.historyEl.querySelectorAll(".ai-msg");
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        if (last.innerHTML.includes("thinking")) {
          last.remove();
        }
      }
    }
    // Remove from modal
    if (this.modalHistoryEl) {
      const modalMessages = this.modalHistoryEl.querySelectorAll(".ai-msg");
      if (modalMessages.length > 0) {
        const last = modalMessages[modalMessages.length - 1];
        if (last.innerHTML.includes("thinking")) {
          last.remove();
        }
      }
    }
  }

  async sendChatMessageFromModal() {
    const text = this.modalInput?.value?.trim();
    if (!text) return;

    // Temporarily swap input reference
    const originalInput = this.chatInput;
    this.chatInput = this.modalInput;
    await this.sendChatMessage();
    this.chatInput = originalInput;
  }

  async sendChatMessage() {
    const text = this.chatInput?.value?.trim();
    if (!text) return;

    this.addMessage("user", text);

    // Show thinking indicator
    const thinkingId = this.addMessage("ai", "<em>thinking...</em>");

    // Write to inbox
    const requestId = crypto.randomUUID();
    const inbox = {
      requestId,
      timestamp: new Date().toISOString(),
      skill: "chat",
      payload: {
        message: this.chatInput.value.trim(),
        context: {
          book: this.currentBook?.title,
          page: this.currentBook?.pages[this.currentPageIndex]?.title,
          pageIndex: this.currentPageIndex,
          totalPages: this.currentBook?.pages.length
        }
      }
    };

    // Write inbox via fetch to bridge handler endpoint
    await this.writeInbox(inbox);

    this.chatInput.value = "";

    // Poll for response
    this.pollOutbox(requestId, thinkingId);
  }

  async writeInbox(inbox) {
    const response = await fetch("/api/write-inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inbox)
    });
    if (!response.ok) {
      console.error("Failed to write inbox");
    }
  }

  async pollOutbox(requestId, thinkingId) {
    const check = setInterval(async () => {
      try {
        const response = await fetch("/api/read-outbox");
        if (!response.ok) return;
        
        const outbox = await response.json();
        if (outbox.requestId === requestId) {
          clearInterval(check);
          this.removeLastThinkingMessage();
          this.addMessage("ai", outbox.payload?.response || "No response");
        }
      } catch (e) {
        console.error("Poll error:", e);
      }
    }, 1000);
  }

  // Parse markdown with marked + DOMPurify + highlight.js for AI messages
  parseMarkdown(text) {
    if (typeof marked === "undefined" || typeof DOMPurify === "undefined") {
      return text; // Fallback if libraries not loaded
    }
    try {
      // Configure marked to use highlight.js for code blocks
      marked.setOptions({
        highlight: (code, lang) => {
          if (typeof hljs !== "undefined") {
            if (lang && hljs.getLanguage(lang)) {
              return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
          }
          return code; // fallback
        },
        breaks: true,
        gfm: true
      });
      
      const html = marked.parse(text);
      // Sanitize with DOMPurify
      const cleanHtml = DOMPurify.sanitize(html, {
        ADD_TAGS: ["pre", "code", "span"],
        ADD_ATTR: ["class"]
      });
      return cleanHtml;
    } catch (e) {
      console.error("Markdown parsing error:", e);
      return text; // Fallback to plain text
    }
  }


  // ============================================================
  // Floating page nav
  // ============================================================

  initFloatingNav() {
    this.prevPageBtn = document.getElementById('prev-page');
    this.nextPageBtn = document.getElementById('next-page');
    this.pageNumberEl = document.getElementById('page-number-floating');  // CHANGED
    
    if (this.prevPageBtn) {
      this.prevPageBtn.addEventListener('click', () => this.goToPrevPage());
    }
    if (this.nextPageBtn) {
      this.nextPageBtn.addEventListener('click', () => this.goToNextPage());
    }
    
    this.updateFloatingPageNumber();
  }

  goToPrevPage() {
    if (this.currentPageIndex > 0) {
      // Switch to Single Page view when navigating
      this.setSinglePageView();
      this.selectPage(this.currentPageIndex - 1);
      this.scrollPageToTop();
    }
  }

  goToNextPage() {
    if (this.currentBook && this.currentPageIndex < this.currentBook.pages.length - 1) {
      // Switch to Single Page view when navigating
      this.setSinglePageView();
      this.selectPage(this.currentPageIndex + 1);
      this.scrollPageToTop();
    }
  }

  // Switch to Single Page view (for page navigation)
  setSinglePageView() {
    if (this.viewFullBook) {
      this.viewFullBook = false;
      this.updateBuildButtonVisibility();
    }
  }

  // Scroll iframe/page to top so user sees page title
  scrollPageToTop() {
    const iframe = document.getElementById('page-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.scrollTo(0, 0);
    }
    // Also scroll the main page to top
    window.scrollTo(0, 0);
  }

  updateFloatingPageNumber() {
    const pageNumEl = document.getElementById('page-number-floating');  // CHANGED
    if (pageNumEl && this.currentBook) {
      pageNumEl.textContent = `${this.currentPageIndex + 1} / ${this.currentBook.pages.length}`;
    }
    
    // Update button states
    if (this.prevPageBtn) {
      this.prevPageBtn.disabled = this.currentPageIndex === 0;
    }
    if (this.nextPageBtn && this.currentBook) {
      this.nextPageBtn.disabled = this.currentPageIndex >= this.currentBook.pages.length - 1;
    }
  }

  // ============================================================
  // Event Bindings
  // ============================================================

  bindEvents() {
    // Prev page button
/*

    const prevBtn = document.getElementById("prev-page");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (this.currentPageIndex > 0) {
          this.selectPage(this.currentPageIndex - 1);
        }
      });
    }
    // Next page button
    const nextBtn = document.getElementById("next-page");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (this.currentBook && this.currentPageIndex < this.currentBook.pages.length - 1) {
          this.selectPage(this.currentPageIndex + 1);
        }
      });
    }
    */

    // Check button
    const checkBtn = document.getElementById("run-check");
    if (checkBtn) {
      checkBtn.addEventListener("click", () => this.runCheck());
    }

    // Screenshot button
    const shotBtn = document.getElementById("take-screenshot");
    if (shotBtn) {
      shotBtn.addEventListener("click", () => this.takeScreenshot());
    }

    // Build book button
    const buildBtn = document.getElementById("build-book");
    if (buildBtn) {
      buildBtn.addEventListener("click", () => this.buildBook());
    }

    // View Full Book button
    const viewFullBtn = document.getElementById("view-full-book");
    if (viewFullBtn) {
      viewFullBtn.addEventListener("click", () => this.toggleFullBookView());
    }

    // Save button
    const saveBtn = document.getElementById("save-edit");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.saveChanges());
    }

    // Editor inputs — update editedContent
    const inputs = ["editor-title", "editor-subtitle", "editor-explain", "editor-action"];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const key = id === "editor-title" ? "title"
          : id === "editor-subtitle" ? "sub"
          : id === "editor-explain" ? "explain"
          : "action";
        el.addEventListener("input", () => {
          this.editedContent[key] = el.value;
          const saveBtn = document.getElementById("save-edit");
          if (saveBtn) saveBtn.disabled = false;
        });
      }
    });

    // Chat send
    const sendBtn = document.getElementById("send-chat");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.sendChatMessage());
    }
    const chatInput = document.getElementById("chat-input");
    if (chatInput) {
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.sendChatMessage();
        }
      });
    }

    // Quick action buttons are already bound in initChatBridge()
    // No duplicate listener needed here

    // New book modal methods
    this.openNewBookModal = this.openNewBookModal.bind(this);
    this.closeNewBookModal = this.closeNewBookModal.bind(this);
    this.generateSlugFromTitle = this.generateSlugFromTitle.bind(this);
    this.validateSlug = this.validateSlug.bind(this);
    this.handleNewBookSubmit = this.handleNewBookSubmit.bind(this);
    this.showNewBookSuccess = this.showNewBookSuccess.bind(this);

    // New book button
    const newBookBtn = document.getElementById("new-book-btn-sidebar");
    if (newBookBtn) {
      newBookBtn.addEventListener("click", this.openNewBookModal);
    }

    // Modal backdrop click to close
    const backdrop = document.getElementById("modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", this.closeNewBookModal);
    }

    // Form submit
    const form = document.getElementById("new-book-form");
    if (form) {
      form.addEventListener("submit", this.handleNewBookSubmit);
    }

    // Real-time slug generation
    const titleInput = document.getElementById("new-book-title");
    if (titleInput) {
      titleInput.addEventListener("input", () => this.generateSlugFromTitle());
    }

    // Escape key to close modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeNewBookModal();
    });

    // Modal close button
    const modalCloseBtn = document.getElementById("modal-close-btn");
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener("click", this.closeNewBookModal);
    }

    // Modal cancel button
    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    if (modalCancelBtn) {
      modalCancelBtn.addEventListener("click", this.closeNewBookModal);
    }

    // Collapse/Expand Editor
    const collapseEditorBtn = document.getElementById("collapse-editor");
    const editorArea = document.getElementById("editor-area");
    if (collapseEditorBtn && editorArea) {
      collapseEditorBtn.addEventListener("click", () => {
        const isCollapsed = editorArea.classList.toggle("collapsed");
        collapseEditorBtn.textContent = isCollapsed ? "Open" : "Close";
        collapseEditorBtn.classList.toggle("expanded", isCollapsed);
        collapseEditorBtn.setAttribute("aria-label", isCollapsed ? "Expand editor" : "Collapse editor");
        collapseEditorBtn.title = isCollapsed ? "Expand" : "Collapse";
      });
    }

    // Collapse/Expand Chat
    const collapseChatBtn = document.getElementById("collapse-chat");
    const chatContainer = document.getElementById("chat-container");
    if (collapseChatBtn && chatContainer) {
      collapseChatBtn.addEventListener("click", () => {
        const isCollapsed = chatContainer.classList.toggle("collapsed");
        collapseChatBtn.textContent = isCollapsed ? "Open" : "Close";
        collapseChatBtn.classList.toggle("expanded", isCollapsed);
        collapseChatBtn.setAttribute("aria-label", isCollapsed ? "Expand chat" : "Collapse chat");
        collapseChatBtn.title = isCollapsed ? "Expand" : "Collapse";
      });
    }
  }

  // ============================================================
  // New Book Modal
  // ============================================================

  openNewBookModal() {
    const modal = document.getElementById("new-book-modal");
    if (modal) {
      modal.style.display = "flex";
      modal.classList.add("opening");
      setTimeout(() => modal.classList.remove("opening"), 300);
      // Focus the title input
      const titleInput = document.getElementById("new-book-title");
      if (titleInput) titleInput.focus();
      // Validate the slug (in case title has a value already)
      this.generateSlugFromTitle();
    }
  }

  closeNewBookModal() {
    const modal = document.getElementById("new-book-modal");
    if (modal) {
      modal.classList.add("closing");
      setTimeout(() => {
        modal.style.display = "none";
        modal.classList.remove("closing");
      }, 200);
    }
  }

  generateSlugFromTitle() {
    const titleInput = document.getElementById("new-book-title");
    const slugDisplay = document.getElementById("new-book-slug-display");
    const slugInput = document.getElementById("new-book-slug-input");
    if (!titleInput || !slugDisplay || !slugInput) return;

    const slug = titleInput.value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    slugDisplay.textContent = slug || "my-new-book";
    slugInput.value = slug;

    // Update validation
    this.validateSlug(slug);
  }

  validateSlug(slug) {
    const valid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
    const validEl = document.querySelector(".slug-valid");
    const invalidEl = document.querySelector(".slug-invalid");

    // Ensure the elements start hidden
    if (validEl) validEl.style.display = valid ? "block" : "none";
    if (invalidEl) invalidEl.style.display = valid ? "none" : "block";

    const createBtn = document.querySelector(".new-book-modal-create");
    if (createBtn) {
      createBtn.disabled = !valid;
    }
  }

  async handleNewBookSubmit(e) {
    e.preventDefault();
    const titleInput = document.getElementById("new-book-title");
    const slugInput = document.getElementById("new-book-slug-input");
    if (!titleInput || !slugInput) return;

    const title = titleInput.value.trim();
    const slug = slugInput.value.trim();
    if (!title || !slug) return;

    // Disable the create button to prevent double-submits
    const createBtn = document.querySelector(".new-book-modal-create");
    if (createBtn) createBtn.disabled = true;

    try {
      const newBook = await this.createBookFolder(title, slug);
      if (newBook) {
        await this.reloadBookIndex();
        this.showNewBookSuccess(newBook);
      }
    } catch (err) {
      console.error("Failed to create book:", err);
      // In a browser environment, creating folders/files requires a backend
      // Show an informative message
      const form = document.getElementById("new-book-form");
      if (form) {
        const errorP = document.createElement("p");
        errorP.style.color = "#ef4444";
        errorP.textContent = `Error: ${err.message}. Book creation requires the Node.js backend server to be running. See the starter scaffold for manual creation instructions.`;
        form.prepend(errorP);
        setTimeout(() => errorP.remove(), 5000);
      }
    } finally {
      if (createBtn) createBtn.disabled = false;
    }
  }

  async createBookFolder(title, slug) {
    // This uses Node.js fs/path modules — works in Electron or via a backend API
    // In a pure browser, this would need to call a /api/create-book endpoint
    try {
      const fs = await import("fs");
      const path = await import("path");
      const fsPromises = fs.promises;

      const booksDir = path.resolve("../../books", slug);
      if (fs.existsSync(booksDir)) {
        throw new Error(`Book folder '${slug}' already exists`);
      }

      // Create the book directory
      await fsPromises.mkdir(booksDir, { recursive: true });

      // Copy starter.html as the interior file
      const starterPath = path.resolve("../../books/starter/starter.html");
      let interiorContent = "";
      try {
        interiorContent = await fsPromises.readFile(starterPath, "utf8");
      } catch {
        // If starter doesn't exist, use a minimal template
        interiorContent = "<html lang=\"en\" data-size=\"b5\">\n<head>\n  <meta charset=\"utf-8\">\n  <title>" + title + "</title>\n  <link rel=\"stylesheet\" href=\"../../engine/sheet.css\">\n  <link rel=\"stylesheet\" href=\"../../engine/sizes/b5.css\">\n  <link rel=\"stylesheet\" href=\"../../engine/themes/studio.css\">\n</head>\n<body>\n  <main class=\"deck\">\n    <section class=\"sheet bb\">\n      <h1 class=\"title\">" + title + "</h1>\n    </section>\n  </main>\n  <script src=\"../../engine/sheet-tools.js\"></script>\n</body>\n</html>";
      }

      // Write the interior file
      await fsPromises.writeFile(path.join(booksDir, slug + ".html"), interiorContent);

      // Generate book.json
      const bookJson = {
        title: title,
        subtitle: "One idea per page, and every page is the same shape.",
        author: "Your Name",
        series: "STEAM-IE",
        brand: "yoursite.com",
        editionLabel: "Edition 1.0",
        unit: "blocks",
        numbered: true,
        contents: true,
        index: true,
        cover: {
          kicker: "A paper-engine book",
          note: "Written one block at a time."
        },
        copyright: {
          year: new Date().getFullYear(),
          rights: "© " + new Date().getFullYear() + " Your Name. All rights reserved.",
          lines: [
            "Set in Space Grotesk, Inter and JetBrains Mono.",
            "Built with the paper engine: github.com/hassancs91/paper-engine"
          ]
        },
        parts: [
          { name: "S", eyebrow: "Science", why: "One line telling the reader why these pages belong together.", blocks: [] },
          { name: "T", eyebrow: "Technology", why: "One line telling the reader why these pages belong together.", blocks: [] },
          { name: "E", eyebrow: "Engineering", why: "One line telling the reader why these pages belong together.", blocks: [] },
          { name: "A", eyebrow: "Arts", why: "One line telling the reader why these pages belong together.", blocks: [] },
          { name: "M", eyebrow: "Mathematics", why: "One line telling the reader why these pages belong together.", blocks: [] },
          { name: "I", eyebrow: "Information", why: "One line telling the reader why these pages belong together.", blocks: [] },
          { name: "E2", eyebrow: "Economics", why: "One line telling the reader why these pages belong together.", blocks: [] }
        ],
        editions: { free: [] }
      };

      await fsPromises.writeFile(path.join(booksDir, "book.json"), JSON.stringify(bookJson, null, 2));

      return { slug, title };
    } catch (err) {
      console.error("createBookFolder error:", err);
      // If fs is not available (browser environment), return null and show manual instructions
      throw err;
    }
  }

  async reloadBookIndex() {
    // Re-fetch the book index to include the new book
    this.bookIndex = null;
    await this.loadBookIndex();
    this.renderBookList();
    this.updateQuickStats();
  }

  showNewBookSuccess(newBook) {
    this.closeNewBookModal();
    // Auto-select the new book in the sidebar
    const bookListItems = document.querySelectorAll("#book-list li");
    bookListItems.forEach(li => {
      if (li.dataset.slug === newBook.slug) {
        li.classList.add("active");
        li.click();
      }
    });
  }
}

// Auto-init on page load
document.addEventListener("DOMContentLoaded", () => {
  window.app = new DashboardApp();
  window.app.init();
});