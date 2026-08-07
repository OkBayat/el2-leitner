(() => {
  "use strict";

  const faNumber = new Intl.NumberFormat("fa-IR");
  const faDate = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "short", day: "numeric" });
  const faToday = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" });
  const state = {
    collections: [],
    canManage: false,
    currentCollection: null,
    currentUser: null,
    editingMetadata: {},
    slugTouched: false,
    toastTimer: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
    return element;
  }

  function setValue(selector, value) {
    const element = $(selector);
    if (element) element.value = value;
    return element;
  }

  function setHidden(selector, hidden) {
    const element = $(selector);
    if (element) element.classList.toggle("hidden", Boolean(hidden));
    return element;
  }

  function on(selector, type, handler) {
    const element = $(selector);
    if (element) element.addEventListener(type, handler);
    return element;
  }

  class ApiError extends Error {
    constructor(message, status = 0, code = "API_ERROR") {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value ?? "").normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
  }

  function slugifyAscii(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 160);
  }

  function kindLabel(kind) {
    return ({ book: "کتاب", exam: "آزمون", topic: "موضوعی", course: "دوره", personal: "شخصی", collection: "مجموعه" })[kind] || "مجموعه";
  }

  function kindIcon(kind) {
    return ({ book: "▤", exam: "◎", topic: "◇", course: "◫", personal: "✦", collection: "▦" })[kind] || "▦";
  }

  function kindTone(kind) {
    return ({ book: "tone-teal", exam: "tone-blue", topic: "tone-violet", course: "tone-orange", personal: "tone-slate", collection: "tone-slate" })[kind] || "tone-slate";
  }

  function statusLabel(status) {
    return ({ published: "منتشرشده", draft: "پیش‌نویس", archived: "آرشیو" })[status] || "مجموعه";
  }

  function visibilityLabel(visibility) {
    return ({ public: "عمومی", unlisted: "فقط با لینک", private: "خصوصی" })[visibility] || "";
  }

  function collectionLevel(collection) {
    const value = String(collection?.metadata?.level || "").trim();
    if (!value) return "—";
    if (value === "Mixed") return "چندسطحی";
    if (value === "B1-C1") return "B1–C1";
    return value;
  }

  function coverCode(collection) {
    const custom = String(collection?.metadata?.coverLabel || "").trim();
    if (custom) return custom.slice(0, 14);
    const title = String(collection?.title || "");
    if (/\bIELTS\b/i.test(title)) return "IELTS";
    const aef = title.match(/American\s+English\s+File\s*(\d+)?/i);
    if (aef) return `AEF${aef[1] ? ` ${aef[1]}` : ""}`;
    return ({ book: "BOOK", exam: "EXAM", topic: "TOPIC", course: "COURSE", personal: "MY SET" })[collection?.kind] || "VOCORA";
  }

  function safeDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : faDate.format(date);
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const raw = response.status === 204 ? "" : await response.text();
    let payload = null;
    if (raw) {
      try { payload = JSON.parse(raw); } catch { throw new ApiError("پاسخ سرور معتبر نبود.", response.status); }
    }
    if (response.status === 401) {
      location.replace(`login.html?returnTo=${encodeURIComponent(location.pathname)}`);
      throw new ApiError("برای ادامه دوباره وارد حساب شو.", 401, "UNAUTHENTICATED");
    }
    if (!response.ok) {
      throw new ApiError(payload?.error?.message || "درخواست انجام نشد.", response.status, payload?.error?.code);
    }
    return payload;
  }

  function showToast(message, isError = false) {
    const toast = $("#toast");
    if (!toast) return;
    clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.classList.toggle("error", Boolean(isError));
    toast.classList.add("show");
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function showNotice(message = "", isError = false) {
    const notice = $("#libraryNotice");
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("error", isError);
    notice.classList.toggle("hidden", !message);
  }

  function collectionCard(collection) {
    const subscribed = Boolean(collection.subscribed);
    const level = collectionLevel(collection);
    const editable = state.canManage;
    const metadataTags = [kindLabel(collection.kind), level !== "—" ? level : "سطح تعیین نشده"]
      .filter(Boolean)
      .map((tag) => `<span class="library-card-tag">${escapeHtml(tag)}</span>`)
      .join("");
    const status = subscribed
      ? `<strong>✓ در جعبه‌ی من</strong>`
      : statusLabel(collection.status);

    return `<article class="library-card ${kindTone(collection.kind)}" data-collection-id="${escapeHtml(collection.id)}">
      <div class="library-card-cover">
        <div class="library-cover-top">
          <span class="library-cover-type">${escapeHtml(kindLabel(collection.kind))}</span>
          <span class="library-cover-icon" aria-hidden="true">${kindIcon(collection.kind)}</span>
        </div>
        <div class="library-cover-bottom">
          <span class="library-cover-count">${faNumber.format(collection.wordCount || 0)} واژه</span>
          <span class="library-cover-code">${escapeHtml(coverCode(collection))}</span>
        </div>
      </div>
      <div class="library-card-body">
        <div class="library-card-title-row">
          <h3 title="${escapeHtml(collection.title)}">${escapeHtml(collection.title)}</h3>
          ${editable ? `<button class="library-card-edit edit-card" data-id="${escapeHtml(collection.id)}" type="button" aria-label="ویرایش ${escapeHtml(collection.title)}" title="ویرایش مجموعه">✎</button>` : ""}
        </div>
        <p class="library-card-description">${escapeHtml(collection.description || "مجموعه‌ای از واژه‌ها برای مسیر یادگیری تو.")}</p>
        <div class="library-card-tags">${metadataTags}<span class="library-card-tag">نسخه ${faNumber.format(collection.contentVersion || 1)}</span></div>
        <div class="library-card-footer">
          <div class="library-card-actions">
            <button class="btn ${subscribed ? "btn-light added" : "btn-primary"} subscribe-card" data-id="${escapeHtml(collection.id)}" type="button">${subscribed ? "✓ اضافه شده" : "افزودن به جعبه"}</button>
            <button class="btn btn-light detail-card" data-id="${escapeHtml(collection.id)}" type="button">مشاهده واژه‌ها</button>
          </div>
          <span class="library-card-status">${status}</span>
        </div>
      </div>
    </article>`;
  }

  function syncKindChips(kind) {
    $$('[data-kind-chip]').forEach((chip) => chip.classList.toggle("active", chip.dataset.kindChip === kind));
  }

  function renderLibrary() {
    const searchInput = $("#librarySearch");
    const kindInput = $("#libraryKindFilter");
    const statusInput = $("#libraryStatusFilter");
    const grid = $("#libraryGrid");
    if (!searchInput || !kindInput || !statusInput || !grid) {
      showNotice("نسخه‌ی صفحه و فایل‌های کتابخانه با هم هماهنگ نیستند. صفحه را یک‌بار تازه‌سازی کن.", true);
      return;
    }

    const search = normalize(searchInput.value);
    const kind = kindInput.value;
    const status = statusInput.value;
    const visible = state.collections.filter((collection) => {
      const level = collectionLevel(collection);
      const matchesSearch = !search || normalize(`${collection.title} ${collection.description || ""} ${collection.kind} ${level}`).includes(search);
      const matchesKind = kind === "all" || collection.kind === kind;
      const matchesStatus = status === "all" || (status === "subscribed" ? collection.subscribed : !collection.subscribed);
      return matchesSearch && matchesKind && matchesStatus;
    });

    const totalWords = state.collections.reduce((sum, collection) => sum + Number(collection.wordCount || 0), 0);
    const subscribedCollections = state.collections.filter((collection) => collection.subscribed);
    const subscribedWords = subscribedCollections.reduce((sum, collection) => sum + Number(collection.wordCount || 0), 0);
    setText("#collectionCount", faNumber.format(state.collections.length));
    setText("#libraryWordCount", faNumber.format(totalWords));
    setText("#subscribedWordCount", faNumber.format(subscribedWords));
    setText("#subscribedCount", faNumber.format(subscribedCollections.length));
    setHidden("#createCollectionBtn", !state.canManage);
    grid.innerHTML = visible.map(collectionCard).join("");
    setHidden("#libraryEmpty", visible.length > 0);
    syncKindChips(kind);
  }

  async function loadLibrary() {
    showNotice("در حال دریافت مجموعه‌ها…");
    const [me, library] = await Promise.all([apiRequest("/api/auth/me"), apiRequest("/api/library")]);
    state.currentUser = me.user;
    state.collections = library.collections || [];
    state.canManage = Boolean(library.capabilities?.canManage);
    setText("#userEmail", state.currentUser.email);
    showNotice("");
    renderLibrary();
  }

  async function setSubscription(collectionId, subscribe) {
    const path = `/api/library/${encodeURIComponent(collectionId)}/subscription`;
    await apiRequest(path, { method: subscribe ? "POST" : "DELETE" });
    const target = state.collections.find((collection) => collection.id === collectionId);
    if (target) target.subscribed = subscribe;
    renderLibrary();
    if (state.currentCollection?.id === collectionId) {
      state.currentCollection.subscribed = subscribe;
      renderDetail();
    }
    showToast(subscribe ? "مجموعه به جعبه‌ی تو اضافه شد." : "مجموعه از جعبه‌ی تو کنار گذاشته شد؛ پیشرفت قبلی حفظ می‌شود.");
  }

  async function openDetail(collectionId) {
    showNotice("در حال دریافت واژه‌های مجموعه…");
    try {
      const response = await apiRequest(`/api/library/${encodeURIComponent(collectionId)}`);
      state.currentCollection = response.collection;
      state.canManage = Boolean(response.capabilities?.canManage);
      renderDetail();
      const dialog = $("#collectionDialog");
      if (dialog && !dialog.open) dialog.showModal();
    } finally {
      showNotice("");
    }
  }

  function renderDetail() {
    const collection = state.currentCollection;
    if (!collection) return;
    const level = collectionLevel(collection);
    setText("#detailIcon", kindIcon(collection.kind));
    setText("#detailKind", kindLabel(collection.kind));
    setText("#detailTitle", collection.title);
    setText("#detailMainName", collection.title);
    setText("#detailDescription", collection.description || "");
    setText("#detailWordCount", faNumber.format(collection.wordCount || 0));
    setText("#detailLevel", level);
    setText("#detailVersion", faNumber.format(collection.contentVersion || 1));
    setText("#detailStatus", statusLabel(collection.status));
    const updated = safeDate(collection.updatedAt);
    setText("#detailSummaryLine", [kindLabel(collection.kind), visibilityLabel(collection.visibility), statusLabel(collection.status), updated ? `ویرایش ${updated}` : null].filter(Boolean).join(" · "));

    const subscribeButton = $("#detailSubscribeBtn");
    if (subscribeButton) {
      subscribeButton.textContent = collection.subscribed ? "✓ اضافه شده به جعبه" : "افزودن به جعبه";
      subscribeButton.classList.toggle("btn-primary", !collection.subscribed);
      subscribeButton.classList.toggle("btn-light", collection.subscribed);
    }
    ["#editCollectionBtn", "#importCollectionBtn", "#addCollectionEntryBtn"].forEach((selector) => setHidden(selector, !state.canManage));
    $$(".admin-entry-column").forEach((element) => element.classList.toggle("hidden", !state.canManage));

    const sections = collection.sections || [];
    const select = $("#detailSectionFilter");
    if (select) {
      const selected = select.value;
      select.innerHTML = `<option value="all">همه‌ی بخش‌ها</option>${sections.map((section) => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.path || section.title)}</option>`).join("")}`;
      if ([...select.options].some((option) => option.value === selected)) select.value = selected;
    }
    renderEntries();
  }

  function filteredEntries() {
    const collection = state.currentCollection;
    if (!collection) return [];
    const search = normalize($("#detailSearch")?.value || "");
    const section = $("#detailSectionFilter")?.value || "all";
    return (collection.entries || []).filter((entry) => {
      const matchesSearch = !search || normalize(`${entry.term} ${(entry.acceptedForms || []).join(" ")} ${entry.sectionPath || ""}`).includes(search);
      const matchesSection = section === "all" || entry.sectionId === section;
      return matchesSearch && matchesSection;
    });
  }

  function renderEntries() {
    const entries = filteredEntries();
    const body = $("#collectionEntriesBody");
    if (body) {
      body.innerHTML = entries.map((entry) => `<tr data-entry-id="${escapeHtml(entry.id)}">
        <td class="word-cell" dir="ltr">${escapeHtml(entry.term)}</td>
        <td>${entry.sectionPath ? `<span class="section-chip">${escapeHtml(entry.sectionPath)}</span>` : "—"}</td>
        <td class="accepted-forms">${escapeHtml((entry.acceptedForms || []).join(" / "))}</td>
        <td class="admin-entry-column ${state.canManage ? "" : "hidden"}"><div class="entry-actions"><button data-action="edit-entry" data-id="${escapeHtml(entry.id)}" type="button">ویرایش</button><button class="danger" data-action="remove-entry" data-id="${escapeHtml(entry.id)}" type="button">حذف</button></div></td>
      </tr>`).join("");
    }
    setHidden("#detailEmpty", entries.length > 0);
    setText("#detailEmpty", (state.currentCollection?.entries || []).length ? "واژه‌ای با این جست‌وجو پیدا نشد." : "هنوز واژه‌ای در این مجموعه نیست.");
  }

  function openCollectionForm(collection = null) {
    state.editingMetadata = { ...(collection?.metadata || {}) };
    state.slugTouched = Boolean(collection);
    setText("#collectionFormTitle", collection ? "ویرایش مجموعه" : "مجموعه‌ی جدید");
    setValue("#collectionEditingId", collection?.id || "");
    setValue("#collectionTitleInput", collection?.title || "");
    setValue("#collectionSlugInput", collection?.slug || "");
    setValue("#collectionDescriptionInput", collection?.description || "");
    setValue("#collectionKindInput", collection?.kind || "book");
    setValue("#collectionLevelInput", collection?.metadata?.level || "");
    setValue("#collectionVisibilityInput", collection?.visibility || "public");
    setValue("#collectionStatusInput", collection?.status || "published");
    const dialog = $("#collectionFormDialog");
    if (dialog) dialog.showModal();
    setTimeout(() => $("#collectionTitleInput")?.focus(), 30);
  }

  async function saveCollection(event) {
    event.preventDefault();
    const editingId = $("#collectionEditingId")?.value || "";
    const metadata = { ...state.editingMetadata };
    const levelInput = $("#collectionLevelInput");
    if (levelInput) {
      const level = levelInput.value;
      if (level) metadata.level = level;
      else delete metadata.level;
    }
    const payload = {
      title: $("#collectionTitleInput")?.value.trim() || "",
      slug: $("#collectionSlugInput")?.value.trim() || "",
      description: $("#collectionDescriptionInput")?.value.trim() || "",
      kind: $("#collectionKindInput")?.value || "book",
      visibility: $("#collectionVisibilityInput")?.value || "public",
      status: $("#collectionStatusInput")?.value || "published",
      metadata
    };
    const response = await apiRequest(editingId ? `/api/library/${encodeURIComponent(editingId)}` : "/api/library", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    $("#collectionFormDialog")?.close();
    await loadLibrary();
    if (editingId) await openDetail(response.collection.id);
    showToast(editingId ? "مشخصات مجموعه به‌روزرسانی شد." : "مجموعه ساخته شد. حالا می‌توانی واژه‌ها را وارد کنی.");
  }

  function openEntryForm(entry = null) {
    setText("#entryFormTitle", entry ? "ویرایش واژه" : "افزودن واژه");
    setValue("#entryEditingId", entry?.id || "");
    setValue("#entryTermInput", entry?.term || "");
    setValue("#entryVariantsInput", entry ? (entry.acceptedForms || []).filter((form) => normalize(form) !== normalize(entry.term)).join(" / ") : "");
    setValue("#entrySectionInput", entry?.sectionPath || "");
    setValue("#entryNoteInput", entry?.note || "");
    $("#entryFormDialog")?.showModal();
  }

  async function saveEntry(event) {
    event.preventDefault();
    const collection = state.currentCollection;
    const entryId = $("#entryEditingId")?.value || "";
    const variants = ($("#entryVariantsInput")?.value || "").split(/\s*\/\s*/).map((value) => value.trim()).filter(Boolean);
    const payload = {
      term: $("#entryTermInput")?.value.trim() || "",
      acceptedForms: variants,
      sectionPath: $("#entrySectionInput")?.value.trim() || null,
      note: $("#entryNoteInput")?.value.trim() || null
    };
    await apiRequest(`/api/library/${encodeURIComponent(collection.id)}/entries${entryId ? `/${encodeURIComponent(entryId)}` : ""}`, {
      method: entryId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    $("#entryFormDialog")?.close();
    await refreshCurrentCollection();
    showToast(entryId ? "واژه به‌روزرسانی شد." : "واژه به مجموعه اضافه شد.");
  }

  async function removeEntry(entryId) {
    const entry = state.currentCollection?.entries?.find((item) => item.id === entryId);
    if (!entry || !confirm(`«${entry.term}» از این مجموعه حذف شود؟ پیشرفت کاربران حفظ می‌شود.`)) return;
    await apiRequest(`/api/library/${encodeURIComponent(state.currentCollection.id)}/entries/${encodeURIComponent(entryId)}`, { method: "DELETE" });
    await refreshCurrentCollection();
    showToast("واژه از مجموعه کنار گذاشته شد.");
  }

  async function refreshCurrentCollection() {
    if (!state.currentCollection) return;
    const response = await apiRequest(`/api/library/${encodeURIComponent(state.currentCollection.id)}`);
    state.currentCollection = response.collection;
    const listItem = state.collections.find((collection) => collection.id === state.currentCollection.id);
    if (listItem) Object.assign(listItem, state.currentCollection);
    renderDetail();
    renderLibrary();
  }

  function openImportDialog() {
    const fileInput = $("#collectionFileInput");
    if (fileInput) fileInput.value = "";
    setText("#selectedFileName", "انتخاب فایل MD / TXT");
    setValue("#importModeInput", "append");
    $("#importDialog")?.showModal();
  }

  async function importCollection(event) {
    event.preventDefault();
    const file = $("#collectionFileInput")?.files?.[0];
    if (!file) return showToast("یک فایل MD یا TXT انتخاب کن.", true);
    const mode = $("#importModeInput")?.value || "append";
    if (mode === "replace" && !confirm("مجموعه دقیقاً با این فایل همگام شود؟ واژه‌های حذف‌شده فقط از مجموعه کنار می‌روند و پیشرفت کاربران حفظ می‌شود.")) return;
    const result = await apiRequest(`/api/library/${encodeURIComponent(state.currentCollection.id)}/import`, {
      method: "POST",
      body: JSON.stringify({ text: await file.text(), mode })
    });
    $("#importDialog")?.close();
    await refreshCurrentCollection();
    const stats = result.result;
    showToast(`${faNumber.format(stats.added)} افزوده، ${faNumber.format(stats.updated)} به‌روزرسانی و ${faNumber.format(stats.removed)} حذف از مجموعه.`);
  }

  function setupTheme() {
    const saved = localStorage.getItem("vocora-library-theme") || "system";
    document.documentElement.dataset.theme = saved === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : saved;
    on("#themeToggle", "click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("vocora-library-theme", next);
    });
  }

  function bindEvents() {
    ["#librarySearch", "#libraryKindFilter", "#libraryStatusFilter"].forEach((selector) => {
      on(selector, selector.includes("Search") ? "input" : "change", renderLibrary);
    });
    $$('[data-kind-chip]').forEach((chip) => chip.addEventListener("click", () => {
      setValue("#libraryKindFilter", chip.dataset.kindChip);
      renderLibrary();
    }));
    on("#libraryGrid", "click", async (event) => {
      const detail = event.target.closest(".detail-card");
      if (detail) return openDetail(detail.dataset.id).catch((error) => showToast(error.message, true));
      const edit = event.target.closest(".edit-card");
      if (edit) {
        const collection = state.collections.find((item) => item.id === edit.dataset.id);
        if (collection) openCollectionForm(collection);
        return;
      }
      const subscription = event.target.closest(".subscribe-card");
      if (subscription) {
        const collection = state.collections.find((item) => item.id === subscription.dataset.id);
        if (collection) await setSubscription(collection.id, !collection.subscribed).catch((error) => showToast(error.message, true));
      }
    });
    on("#detailSubscribeBtn", "click", () => {
      if (!state.currentCollection) return;
      setSubscription(state.currentCollection.id, !state.currentCollection.subscribed).catch((error) => showToast(error.message, true));
    });
    on("#createCollectionBtn", "click", () => openCollectionForm());
    on("#editCollectionBtn", "click", () => openCollectionForm(state.currentCollection));
    on("#collectionForm", "submit", (event) => saveCollection(event).catch((error) => showToast(error.message, true)));
    on("#collectionTitleInput", "input", (event) => {
      if ($("#collectionEditingId")?.value || state.slugTouched) return;
      const slug = slugifyAscii(event.target.value);
      if (slug) setValue("#collectionSlugInput", slug);
    });
    on("#collectionSlugInput", "input", () => { state.slugTouched = true; });
    on("#addCollectionEntryBtn", "click", () => openEntryForm());
    on("#entryForm", "submit", (event) => saveEntry(event).catch((error) => showToast(error.message, true)));
    on("#importCollectionBtn", "click", openImportDialog);
    on("#importForm", "submit", (event) => importCollection(event).catch((error) => showToast(error.message, true)));
    on("#collectionFileInput", "change", (event) => {
      setText("#selectedFileName", event.target.files[0]?.name || "انتخاب فایل MD / TXT");
    });
    const drop = $(".library-file-drop");
    if (drop) {
      ["dragenter", "dragover"].forEach((type) => drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.add("is-dragging");
      }));
      ["dragleave", "drop"].forEach((type) => drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.remove("is-dragging");
      }));
      drop.addEventListener("drop", (event) => {
        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        const fileInput = $("#collectionFileInput");
        if (fileInput && typeof DataTransfer === "function") {
          const transfer = new DataTransfer();
          transfer.items.add(file);
          fileInput.files = transfer.files;
        }
        setText("#selectedFileName", file.name);
      });
    }
    on("#detailSearch", "input", renderEntries);
    on("#detailSectionFilter", "change", renderEntries);
    on("#collectionEntriesBody", "click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const entry = state.currentCollection?.entries?.find((item) => item.id === button.dataset.id);
      if (button.dataset.action === "edit-entry" && entry) openEntryForm(entry);
      if (button.dataset.action === "remove-entry") removeEntry(button.dataset.id).catch((error) => showToast(error.message, true));
    });
    $$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => {
      const dialog = document.getElementById(button.dataset.closeDialog);
      if (dialog?.open) dialog.close();
    }));
    $$(".library-dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    }));
    on("#logoutBtn", "click", async () => {
      try { await apiRequest("/api/auth/logout", { method: "POST" }); } finally { location.replace("login.html"); }
    });
  }

  async function boot() {
    setText("#libraryDate", faToday.format(new Date()));
    setupTheme();
    bindEvents();
    try {
      await loadLibrary();
      const deepLink = decodeURIComponent(location.hash.slice(1));
      if (deepLink && state.collections.some((collection) => collection.id === deepLink)) {
        await openDetail(deepLink);
      }
    } catch (error) {
      if (error.status !== 401) showNotice(error.message || "کتابخانه بارگذاری نشد.", true);
    }
  }

  window.VocoraLibraryTest = { normalize, kindLabel, escapeHtml, collectionLevel, slugifyAscii, kindTone };
  boot();
})();
