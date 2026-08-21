(() => {
  "use strict";

  const importPrompt = `این دستور را همراه فایل یا متن منبع واژگان به ChatGPT بده:

تمام لغت‌ها، عبارت‌ها، phrasal verbها، idiomها و collocationهای منبع را استخراج کن و خروجی را فقط به صورت Markdown خام، بدون توضیح اضافی و بدون code fence بده.

قواعد قالب Vocora:
- عنوان اصلی می‌تواند با # باشد؛ برای ساختار بخش‌ها از ## تا ###### استفاده کن.
- هر واژه یا عبارت باید در یک خط شماره‌دار به شکل 1. word باشد.
- شماره‌ها در کل فایل پیوسته و یکتا باشند.
- اگر یک واژه چند املای پذیرفته دارد، آن‌ها را با " / " و با فاصله در دو طرف در همان خط بنویس؛ مثل: 2. centre / center
- عبارت‌ها، اصطلاحات و collocationها را به عنوان یک مدخل کامل نگه دار و کلمات داخل آن‌ها را جدا نکن.
- تکراری‌ها را حذف کن.
- داخل خطوط واژگان تعریف، ترجمه، مثال یا توضیح اضافه نکن، مگر اینکه صریحاً از تو خواسته شده باشد.
- ساختار بخش‌های منبع را تا حد ممکن با headingها حفظ کن.

نمونه‌ی خروجی:
# American English File 3

## Unit 1
### Lesson A
1. crowded
2. centre / center

### Lesson B
3. get along with`;

  const copyButton = document.getElementById("copyImportTemplateBtn");
  const createButton = document.getElementById("createCollectionBtn");
  const toast = document.getElementById("toast");
  if (!copyButton) return;

  function syncAvailability() {
    copyButton.classList.toggle("hidden", !createButton || createButton.classList.contains("hidden"));
  }

  function showStatus(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 3200);
  }

  async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand?.("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard API is unavailable.");
  }

  copyButton.addEventListener("click", async () => {
    try {
      await writeClipboard(importPrompt);
      showStatus("قالب آماده‌ی ChatGPT برای ورود واژگان کپی شد.");
    } catch {
      showStatus("کپی قالب انجام نشد. دسترسی Clipboard مرورگر را بررسی کن.", true);
    }
  });

  syncAvailability();
  if (createButton && typeof MutationObserver === "function") {
    new MutationObserver(syncAvailability).observe(createButton, { attributes: true, attributeFilter: ["class"] });
  }

  window.VocoraLibraryImportTemplate = { importPrompt, writeClipboard };
})();
