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

    this.initChat();
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
    } else {
      buildBtn.style.display = "inline-flex";
      buildBtn.disabled = false;
      buildBtn.textContent = "Build Book";
      viewFullBtn.style.display = "none";
    }
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
  // Mock AI Chat
  // ============================================================

  initChat() {
    const historyEl = document.getElementById("chat-history");
    if (historyEl) {
      historyEl.innerHTML = "";
      const welcome = document.createElement("div");
      welcome.className = "ai-msg";
      welcome.innerHTML = "<strong>AI:</strong> I'm connected to the mock responder. The real agent will use the file-bridge pattern (chat-inbox.json → chat-outbox.json). Try a quick-action button below!";
      historyEl.appendChild(welcome);
    }
  }

  async sendMessage() {
    const input = document.getElementById("chat-input");
    const historyEl = document.getElementById("chat-history");
    if (!input || !historyEl) return;

    const text = input.value.trim();
    if (!text) return;

    // Add user message
    const userMsg = document.createElement("div");
    userMsg.className = "user-msg";
    userMsg.innerHTML = `<strong>You:</strong> ${text}`;
    historyEl.appendChild(userMsg);
    input.value = "";

    // Show typing indicator
    const typing = document.createElement("div");
    typing.className = "ai-msg";
    typing.innerHTML = "<strong>AI:</strong> <em>thinking...</em>";
    historyEl.appendChild(typing);
    historyEl.scrollTop = historyEl.scrollHeight;

    // Wait then give mock reply
    const reply = this.getMockReply(text);
    setTimeout(() => {
      historyEl.removeChild(typing);
      const aiMsg = document.createElement("div");
      aiMsg.className = "ai-msg";
      aiMsg.innerHTML = `<strong>AI:</strong> ${reply}`;
      historyEl.appendChild(aiMsg);
      historyEl.scrollTop = historyEl.scrollHeight;
    }, 500);
  }

  getMockReply(text) {
    const lower = text.toLowerCase();
    if (lower.includes("overflow") || lower.includes("check")) return "The current page fits within the 176 x 250 mm B5 canvas (0 mm overflow). If you add more content, watch the action box — that's the first element to overflow.";
    if (lower.includes("diagram")) return "For a 'book' topic, try a 'Protection' diagram: a hit, the buffer, then the outcome. Keep colors explicit: red for the threat, teal for the good outcome.";
    if (lower.includes("rewrite") || lower.includes("simpler")) return "I'd rephrase that in plainer words, starting with a 'Let's say…' opening and ending with a one-line closer.";
    if (lower.includes("image")) return "Prompt: A flat-lay photograph of an open book on a wooden desk, soft morning light from the left, neutral linen background. Forbidden: no text in the image, no logos. Same book style as before.";
    return "I'm a mock responder. Replace me with the file-bridge agent connection when you implement Phase 4. Try one of the quick-action buttons!";
  }

  // ============================================================
  // Event Bindings
  // ============================================================

  bindEvents() {
    // Prev page button
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
      sendBtn.addEventListener("click", () => this.sendMessage());
    }
    const chatInput = document.getElementById("chat-input");
    if (chatInput) {
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // Quick action buttons
    const quickActions = document.querySelectorAll(".quick-action");
    quickActions.forEach(btn => {
      btn.addEventListener("click", () => {
        const prompt = btn.dataset.prompt;
        if (document.getElementById("chat-input")) {
          document.getElementById("chat-input").value = prompt;
          this.sendMessage();
        }
      });
    });

    // New book button
    const newBookBtn = document.getElementById("new-book-btn");
    if (newBookBtn) {
      newBookBtn.addEventListener("click", () => {
        alert("New Book modal would open here. In Phase 1+, this creates a new folder from the starter scaffold.");
      });
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
    const chatArea = document.getElementById("chat-area");
    if (collapseChatBtn && chatArea) {
      collapseChatBtn.addEventListener("click", () => {
        const isCollapsed = chatArea.classList.toggle("collapsed");
        collapseChatBtn.textContent = isCollapsed ? "Open" : "Close";
        collapseChatBtn.classList.toggle("expanded", isCollapsed);
        collapseChatBtn.setAttribute("aria-label", isCollapsed ? "Expand chat" : "Collapse chat");
        collapseChatBtn.title = isCollapsed ? "Expand" : "Collapse";
      });
    }
  }
}

// Auto-init on page load
document.addEventListener("DOMContentLoaded", () => {
  window.app = new DashboardApp();
  window.app.init().then(() => {
    window.app.initChat();
  });
});