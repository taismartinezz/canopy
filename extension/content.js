// Content script — extracts page metadata and returns it to the popup via messaging.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "GET_PAGE_META") return;

  const meta = (name) =>
    document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute("content") ?? "";

  // DOI: check common meta tags and URL patterns
  const doiMeta = meta("dc.identifier") || meta("citation_doi") || meta("prism.doi");
  const doiUrl  = /\b(10\.\d{4,}\/[^\s"<>#]+)/.exec(window.location.href)?.[1] ?? "";
  const doi     = (doiMeta || doiUrl).replace(/^doi:/i, "").trim() || undefined;

  // Authors from citation_author meta (multiple) or dc.creator
  const authorMetas = [...document.querySelectorAll('meta[name="citation_author"]')].map((el) => el.getAttribute("content") ?? "");
  const authors     = authorMetas.length ? authorMetas : (meta("dc.creator") ? [meta("dc.creator")] : []);

  const yearStr = meta("citation_publication_date") || meta("dc.date") || meta("prism.publicationDate") || "";
  const year    = parseInt(yearStr) || undefined;

  sendResponse({
    title:   meta("citation_title") || meta("dc.title") || document.title || "",
    url:     window.location.href,
    doi,
    authors,
    year,
    journal: meta("citation_journal_title") || meta("prism.publicationName") || undefined,
    abstract: meta("description") || meta("dc.description") || undefined,
  });
  return true; // keep message channel open for async
});
