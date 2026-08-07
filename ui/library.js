(() => {
  "use strict";

  const faNumber = new Intl.NumberFormat("fa-IR");
  const state = {
    collections: [],
    canManage: false,
    currentCollection: null,
    currentUser: null,
    toastTimer: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

  function kindLabel(kind) {
    return ({ book: "کتاب", exam: "آزمون", topic: "موضوع", course: "دوره", personal: "شخصی", collection: "مجموعه" })[kind] || "مجموعه";
  }

  function kindIcon(kind) {
    return ({ book: "▤", exam: "◎", topic: "◇", course: "◫", personal: "✦" })[kind] || "▦";
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
    clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.classList.toggle("error", Boolean(isError));
    toast.classList.add("show");
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function showNotice(message = "", isError = false) {
    const notice = $("#libraryNotice");
    notice.textContent = message;
    notice.classList.toggle("error", isError);
    notice.classList.toggle("hidden", !message);
  }

  function collectionCard(collection) {
    const subscribed = collection.subscribed;
    const statusText = collection.status === "published" ? "منتشرشده" : collection.status === "draft" ? "پیش‌نویس" : "آرشیو";
    return `<article class="library-card" data-collection-id="${escapeHtml(collection.id)}">
      <div class="library-card-head">
        <span class="library-card-icon" aria-hidden="true">${kindIcon(collection.kind)}</span>
        <span class="library-card-badge ${subscribed ? "" : "available"}">${subscribed ? "در جعبهٔ من" : statusText}</span>
      </div>
      <div>
        <span class="library-kicker">${escapeHtml(kindLabel(collection.kind))}</span>
        <h3>${escapeHtml(collection.title)}</h3>
        <p>${escapeHtml(collection.description || "مجموعه‌ای از واژه‌ها برای مسیر یادگیری تو.")}</p>
      </div>
      <div class="library-card-meta"><span><b>${faNumber.format(collection.wordCount)}</b> واژه</span><span>نسخه <b>${faNumber.format(collection.contentVersion)}</b></span></div>
      <div class="library-card-actions">
        <button class="btn ${subscribed ? "btn-light" : "btn-primary"} subscribe-card" data-id="${escapeHtml(collection.id)}" type="button">${subscribed ? "حذف از جعبه" : "افزودن به جعبه"}</button>
        <button class="btn btn-light detail-card" data-id="${escapeHtml(collection.id)}" type="button">مشاهده واژه‌ها</button>
      </div>
    </article>`;
  }

  function renderLibrary() {
    const search = normalize($("#librarySearch").value);
    const kind = $("#libraryKindFilter").value;
    const status = $("#libraryStatusFilter").value;
    const visible = state.collections.filter((collection) => {
      const matchesSearch = !search || normalize(`${collection.title} ${collection.description || ""} ${collection.kind}`).includes(search);
      const matchesKind = kind === "all" || collection.kind === kind;
      const matchesStatus = status === "all" || (status === "subscribed" ? collection.subscribed : !collection.subscribed);
      return matchesSearch && matchesKind && matchesStatus;
    });

    $("#collectionCount").textContent = faNumber.format(state.collections.length);
    $("#subscribedCount").textContent = faNumber.format(state.collections.filter((collection) => collection.subscribed).length);
    $("#createCollectionBtn").classList.toggle("hidden", !state.canManage);
    $("#libraryGrid").innerHTML = visible.map(collectionCard).join("");
    $("#libraryEmpty").classList.toggle("hidden", visible.length > 0);
  }

  async function loadLibrary() {
    showNotice("در حال دریافت مجموعه‌ها…");
    const [me, library] = await Promise.all([apiRequest("/api/auth/me"), apiRequest("/api/library")]);
    state.currentUser = me.user;
    state.collections = library.collections || [];
    state.canManage = Boolean(library.capabilities?.canManage);
    $("#userEmail").textContent = state.currentUser.email;
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
    showToast(subscribe ? "مجموعه به جعبهٔ تو اضافه شد." : "مجموعه از جعبهٔ تو کنار گذاشته شد؛ پیشرفت قبلی حفظ می‌شود.");
  }

  async function openDetail(collectionId) {
    showNotice("در حال دریافت واژه‌های مجموعه…");
    try {
      const response = await apiRequest(`/api/library/${encodeURIComponent(collectionId)}`);
      state.currentCollection = response.collection;
      state.canManage = Boolean(response.capabilities?.canManage);
      renderDetail();
      if (!$("#collectionDialog").open) $("#collectionDialog").showModal();
    } finally {
      showNotice("");
    }
  }

  function renderDetail() {
    const collection = state.currentCollection;
    if (!collection) return;
    $("#detailKind").textContent = kindLabel(collection.kind);
    $("#detailTitle").textContent = collection.title;
    $("#detailDescription").textContent = collection.description || "";
    $("#detailWordCount").textContent = faNumber.format(collection.wordCount);
    $("#detailVersion").textContent = faNumber.format(collection.contentVersion);
    $("#detailStatus").textContent = collection.status === "published" ? "منتشرشده" : collection.status === "draft" ? "پیش‌نویس" : "آرشیو";
    const subscribeButton = $("#detailSubscribeBtn");
    subscribeButton.textContent = collection.subscribed ? "حذف از جعبه" : "افزودن به جعبه";
    subscribeButton.classList.toggle("btn-primary", !collection.subscribed);
    subscribeButton.classList.toggle("btn-light", collection.subscribed);
    ["#editCollectionBtn", "#importCollectionBtn", "#addCollectionEntryBtn"].forEach((selector) => $(selector).classList.toggle("hidden", !state.canManage));
    $$(".admin-entry-column").forEach((element) => element.classList.toggle("hidden", !state.canManage));

    const sections = collection.sections || [];
    const select = $("#detailSectionFilter");
    const selected = select.value;
    select.innerHTML = `<option value="all">همهٔ بخش‌ها</option>${sections.map((section) => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.path || section.title)}</option>`).join("")}`;
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
    renderEntries();
  }

  function filteredEntries() {
    const collection = state.currentCollection;
    if (!collection) return [];
    const search = normalize($("#detailSearch").value);
    const section = $("#detailSectionFilter").value;
    return (collection.entries || []).filter((entry) => {
      const matchesSearch = !search || normalize(`${entry.term} ${(entry.acceptedForms || []).join(" ")} ${entry.sectionPath || ""}`).includes(search);
      const matchesSection = section === "all" || entry.sectionId === section;
      return matchesSearch && matchesSection;
    });
  }

  function renderEntries() {
    const entries = filteredEntries();
    $("#collectionEntriesBody").innerHTML = entries.map((entry) => `<tr data-entry-id="${escapeHtml(entry.id)}">
      <td class="word-cell" dir="ltr">${escapeHtml(entry.term)}</td>
      <td>${entry.sectionPath ? `<span class="section-chip">${escapeHtml(entry.sectionPath)}</span>` : "—"}</td>
      <td class="accepted-forms">${escapeHtml((entry.acceptedForms || []).join(" / "))}</td>
      <td class="admin-entry-column ${state.canManage ? "" : "hidden"}"><div class="entry-actions"><button data-action="edit-entry" data-id="${escapeHtml(entry.id)}" type="button">ویرایش</button><button class="danger" data-action="remove-entry" data-id="${escapeHtml(entry.id)}" type="button">حذف</button></div></td>
    </tr>`).join("");
    $("#detailEmpty").classList.toggle("hidden", entries.length > 0);
    $("#detailEmpty").textContent = (state.currentCollection?.entries || []).length ? "واژه‌ای با این جست‌وجو پیدا نشد." : "هنوز واژه‌ای در این مجموعه نیست.";
  }

  function openCollectionForm(collection = null) {
    $("#collectionFormTitle").textContent = collection ? "ویرایش مجموعه" : "مجموعهٔ جدید";
    $("#collectionEditingId").value = collection?.id || "";
    $("#collectionTitleInput").value = collection?.title || "";
    $("#collectionSlugInput").value = collection?.slug || "";
    $("#collectionDescriptionInput").value = collection?.description || "";
    $("#collectionKindInput").value = collection?.kind || "book";
    $("#collectionVisibilityInput").value = collection?.visibility || "public";
    $("#collectionStatusInput").value = collection?.status || "published";
    $("#collectionFormDialog").showModal();
    setTimeout(() => $("#collectionTitleInput").focus(), 30);
  }

  async function saveCollection(event) {
    event.preventDefault();
    const editingId = $("#collectionEditingId").value;
    const payload = {
      title: $("#collectionTitleInput").value.trim(),
      slug: $("#collectionSlugInput").value.trim(),
      description: $("#collectionDescriptionInput").value.trim(),
      kind: $("#collectionKindInput").value,
      visibility: $("#collectionVisibilityInput").value,
      status: $("#collectionStatusInput").value
    };
    const response = await apiRequest(editingId ? `/api/library/${encodeURIComponent(editingId)}` : "/api/library", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    $("#collectionFormDialog").close();
    await loadLibrary();
    if (editingId) await openDetail(response.collection.id);
    showToast(editingId ? "مشخصات مجموعه به‌روزرسانی شد." : "مجموعه ساخته شد. حالا می‌توانی واژه‌ها را وارد کنی.");
  }

  function openEntryForm(entry = null) {
    $("#entryFormTitle").textContent = entry ? "ویرایش واژه" : "افزودن واژه";
    $("#entryEditingId").value = entry?.id || "";
    $("#entryTermInput").value = entry?.term || "";
    $("#entryVariantsInput").value = entry ? (entry.acceptedForms || []).filter((form) => normalize(form) !== normalize(entry.term)).join(" / ") : "";
    $("#entrySectionInput").value = entry?.sectionPath || "";
    $("#entryNoteInput").value = entry?.note || "";
    $("#entryFormDialog").showModal();
  }

  async function saveEntry(event) {
    event.preventDefault();
    const collection = state.currentCollection;
    const entryId = $("#entryEditingId").value;
    const variants = $("#entryVariantsInput").value.split(/\s*\/\s*/).map((value) => value.trim()).filter(Boolean);
    const payload = {
      term: $("#entryTermInput").value.trim(),
      acceptedForms: variants,
      sectionPath: $("#entrySectionInput").value.trim() || null,
      note: $("#entryNoteInput").value.trim() || null
    };
    await apiRequest(`/api/library/${encodeURIComponent(collection.id)}/entries${entryId ? `/${encodeURIComponent(entryId)}` : ""}`, {
      method: entryId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    $("#entryFormDialog").close();
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
    $("#collectionFileInput").value = "";
    $("#selectedFileName").textContent = "انتخاب فایل MD / TXT";
    $("#importModeInput").value = "append";
    $("#importDialog").showModal();
  }

  async function importCollection(event) {
    event.preventDefault();
    const file = $("#collectionFileInput").files[0];
    if (!file) return showToast("یک فایل MD یا TXT انتخاب کن.", true);
    const mode = $("#importModeInput").value;
    if (mode === "replace" && !confirm("مجموعه دقیقاً با این فایل همگام شود؟ واژه‌های حذف‌شده فقط از مجموعه کنار می‌روند و پیشرفت کاربران حفظ می‌شود.")) return;
    const result = await apiRequest(`/api/library/${encodeURIComponent(state.currentCollection.id)}/import`, {
      method: "POST",
      body: JSON.stringify({ text: await file.text(), mode })
    });
    $("#importDialog").close();
    await refreshCurrentCollection();
    const stats = result.result;
    showToast(`${faNumber.format(stats.added)} افزوده، ${faNumber.format(stats.updated)} به‌روزرسانی و ${faNumber.format(stats.removed)} حذف از مجموعه.`);
  }

  function setupTheme() {
    const saved = localStorage.getItem("vocora-library-theme") || "system";
    document.documentElement.dataset.theme = saved === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : saved;
    $("#themeToggle").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("vocora-library-theme", next);
    });
  }

  function bindEvents() {
    ["#librarySearch", "#libraryKindFilter", "#libraryStatusFilter"].forEach((selector) => {
      $(selector).addEventListener(selector.includes("Search") ? "input" : "change", renderLibrary);
    });
    $("#libraryGrid").addEventListener("click", async (event) => {
      const detail = event.target.closest(".detail-card");
      if (detail) return openDetail(detail.dataset.id).catch((error) => showToast(error.message, true));
      const subscription = event.target.closest(".subscribe-card");
      if (subscription) {
        const collection = state.collections.find((item) => item.id === subscription.dataset.id);
        if (collection) await setSubscription(collection.id, !collection.subscribed).catch((error) => showToast(error.message, true));
      }
    });
    $("#detailSubscribeBtn").addEventListener("click", () => {
      if (!state.currentCollection) return;
      setSubscription(state.currentCollection.id, !state.currentCollection.subscribed).catch((error) => showToast(error.message, true));
    });
    $("#createCollectionBtn").addEventListener("click", () => openCollectionForm());
    $("#editCollectionBtn").addEventListener("click", () => openCollectionForm(state.currentCollection));
    $("#collectionForm").addEventListener("submit", (event) => saveCollection(event).catch((error) => showToast(error.message, true)));
    $("#addCollectionEntryBtn").addEventListener("click", () => openEntryForm());
    $("#entryForm").addEventListener("submit", (event) => saveEntry(event).catch((error) => showToast(error.message, true)));
    $("#importCollectionBtn").addEventListener("click", openImportDialog);
    $("#importForm").addEventListener("submit", (event) => importCollection(event).catch((error) => showToast(error.message, true)));
    $("#collectionFileInput").addEventListener("change", (event) => {
      $("#selectedFileName").textContent = event.target.files[0]?.name || "انتخاب فایل MD / TXT";
    });
    $("#detailSearch").addEventListener("input", renderEntries);
    $("#detailSectionFilter").addEventListener("change", renderEntries);
    $("#collectionEntriesBody").addEventListener("click", (event) => {
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
    $("#logoutBtn").addEventListener("click", async () => {
      try { await apiRequest("/api/auth/logout", { method: "POST" }); } finally { location.replace("login.html"); }
    });
  }

  async function boot() {
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

  window.VocoraLibraryTest = { normalize, kindLabel, escapeHtml };
  boot();
})();
