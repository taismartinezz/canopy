const $ = (id) => document.getElementById(id);

// ── Settings ──────────────────────────────────────────────────────────────────

chrome.storage.local.get(["canopyUrl", "authToken"], ({ canopyUrl, authToken }) => {
  if (canopyUrl)  $("canopy-url").value  = canopyUrl;
  if (authToken)  $("auth-token").value  = authToken;
});

$("toggle-settings").addEventListener("click", () => {
  $("settings-panel").classList.toggle("open");
});

$("save-settings").addEventListener("click", () => {
  const url   = $("canopy-url").value.trim().replace(/\/$/, "");
  const token = $("auth-token").value.trim();
  chrome.storage.local.set({ canopyUrl: url, authToken: token }, () => {
    $("settings-panel").classList.remove("open");
    setStatus("Settings saved.", "ok");
  });
});

// ── Page metadata ─────────────────────────────────────────────────────────────

function setStatus(msg, cls) {
  const el = $("status");
  el.textContent = msg;
  el.className   = cls ?? "";
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_META" }, (meta) => {
    if (chrome.runtime.lastError || !meta) {
      // content script not injected (e.g. chrome:// pages) — prefill from tab
      $("title").value = tab.title ?? "";
      $("save-btn").disabled = false;
      return;
    }
    $("title").value   = meta.title   ?? "";
    $("doi").value     = meta.doi     ?? "";
    $("year").value    = meta.year    ?? "";
    $("authors").value = (meta.authors ?? []).join(", ");
    $("save-btn").disabled = false;
  });
});

// ── Save ──────────────────────────────────────────────────────────────────────

$("save-btn").addEventListener("click", async () => {
  chrome.storage.local.get(["canopyUrl", "authToken"], async ({ canopyUrl, authToken }) => {
    if (!canopyUrl || !authToken) {
      setStatus("Open Settings and enter your Canopy URL and auth token.", "err");
      $("settings-panel").classList.add("open");
      return;
    }

    const title = $("title").value.trim();
    if (!title) { setStatus("Title is required.", "err"); return; }

    $("save-btn").disabled = true;
    setStatus("Saving…");

    const [tab] = await new Promise((res) =>
      chrome.tabs.query({ active: true, currentWindow: true }, res)
    );

    const payload = {
      title,
      url:     tab.url,
      doi:     $("doi").value.trim()     || undefined,
      year:    parseInt($("year").value) || undefined,
      authors: $("authors").value.split(",").map((a) => a.trim()).filter(Boolean),
      scope:   $("scope").value,
    };

    try {
      const res = await fetch(`${canopyUrl}/api/literature/save`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatus("Saved to Canopy!", "ok");
    } catch (err) {
      setStatus(`Error: ${err.message}`, "err");
      $("save-btn").disabled = false;
    }
  });
});
