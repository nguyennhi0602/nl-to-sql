---
phase: 02-chat-ui
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - backend/public/index.html
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

`backend/public/index.html` is a single-file frontend implementing the Phase 2 chat UI: history cards, placeholder lifecycle, `loadHistory`, `clearHistory`, and a refactored `ask()` function. The `escHtml()` helper is in place and used correctly in the new Phase 2 code paths. However, two pre-existing functions (`loadSchema`) that were not updated in Phase 2 contain unescaped schema values interpolated directly into innerHTML. A second XSS exists in `renderSqlBox` via an unsafe `JSON.stringify`-in-onclick pattern. Beyond XSS, there are several correctness and robustness gaps: `clearHistory` silently succeeds even when the server DELETE fails, `loadSchema` has no error handling at all, and the `badgeHtml` path renders the literal string `"null rows"` on successful queries that return no rows.

---

## Critical Issues

### CR-01: Stored XSS — Unescaped schema names in `loadSchema`

**File:** `backend/public/index.html:579,582`

**Issue:** `loadSchema` fetches `/api/schema` and interpolates `t.name`, `c.name`, and `c.type` directly into an innerHTML template literal with no escaping. If the connected SQLite database contains a table or column whose name includes HTML/JS (`"><script>alert(1)</script>`), the schema sidebar executes attacker-controlled HTML on every page load. While table names are typically controlled by the developer, this is still a stored XSS — if an attacker can rename a table or column (e.g., via another vulnerability or direct DB access), every user of the tool is compromised.

```js
// Vulnerable — line 579
${t.name}

// Vulnerable — line 582
${c.name}${c.pk ? ' 🔑' : ''}  ...  ${c.type}
```

**Fix:** Run all three values through `escHtml()` before interpolation:

```js
${escHtml(t.name)}

`<div class="col-row">
  <span class="col-name">${escHtml(c.name)}${c.pk ? ' &#x1F511;' : ''}</span>
  <span class="col-type">${escHtml(c.type)}</span>
</div>`
```

---

### CR-02: XSS via `JSON.stringify(sql)` injected into an `onclick` HTML attribute

**File:** `backend/public/index.html:672`

**Issue:** `renderSqlBox` builds the copy button with:

```js
`<button class="copy-btn" onclick="copyText(${JSON.stringify(sql)}, this)">Copy</button>`
```

`JSON.stringify` produces a quoted JSON string (e.g. `"SELECT * FROM t"`), which is then embedded raw inside an HTML attribute string and assigned to `innerHTML`. `JSON.stringify` does NOT escape `<`, `>`, or `</`. A SQL value containing `</button>` or `">` terminates the button element in the HTML parser before the onclick is fully closed, enabling injection of arbitrary HTML. Example: if `sql` is `SELECT 1</button><img src=x onerror=alert(1)>`, the injected markup executes.

The AI-generated SQL comes from the Groq API and is not sanitised by the backend before being stored and returned — so a manipulated API response or a maliciously crafted prompt injection can deliver such a string.

**Fix:** Pass the SQL to the copy handler via a `data-` attribute and retrieve it in JS, or use `escHtml()` on the JSON-stringified value:

```js
// Option A — data attribute (preferred)
const btn = document.createElement('button');
btn.className = 'copy-btn';
btn.dataset.sql = sql;
btn.textContent = 'Copy';
btn.addEventListener('click', function() { copyText(this.dataset.sql, this); });

// Option B — escape the JSON string for HTML attribute context
`onclick="copyText(${escHtml(JSON.stringify(sql))}, this)"`
```

Note that Option B also requires `escHtml` to escape single-quotes (`'`) if the attribute uses single-quote delimiters — see WR-01.

---

### CR-03: `clearHistory` silently wipes the UI even when the server DELETE fails

**File:** `backend/public/index.html:804-811`

**Issue:** `clearHistory` awaits the DELETE fetch but has no try/catch and does not check `res.ok`. If the network request fails (connection error, server error, timeout), the `await fetch(...)` line throws — the unhandled rejection propagates silently in the browser, and depending on engine/version may or may not clear the UI. More importantly, even on a 4xx/5xx HTTP response the `await` resolves (the response object is returned, not thrown), so execution continues and the UI is cleared to the empty state while the server still holds all the history data. On next page load, `loadHistory` will repopulate the feed, causing a confusing flash of "empty" followed by all history reappearing.

```js
// Current — no error handling
await fetch('/api/history', { method: 'DELETE' });
const feed = document.getElementById('results');
feed.innerHTML = '';   // clears UI even on server error
```

**Fix:**

```js
async function clearHistory() {
  if (!window.confirm('Clear all history?')) return;
  try {
    const res = await fetch('/api/history', { method: 'DELETE' });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const feed = document.getElementById('results');
    feed.innerHTML = '<div class="empty-state">...</div>';
    document.getElementById('clearHistoryBtn').style.display = 'none';
  } catch (err) {
    alert('Failed to clear history. Please try again.');
    console.error('clearHistory failed:', err);
  }
}
```

---

## Warnings

### WR-01: `escHtml` does not escape single-quote `'`

**File:** `backend/public/index.html:722-728`

**Issue:** The `escHtml` helper escapes `&`, `<`, `>`, and `"` but omits `'`. This is not currently exploitable in the new Phase 2 code because all HTML attribute delimiters in `buildHistoryCard` and `buildPlaceholderCard` use double-quotes and the values are placed in text-node positions. However, if the CR-02 fix (Option B) is applied using `escHtml` inside a `'`-delimited attribute, or if any future code places an `escHtml`-escaped value inside a single-quoted HTML attribute, the gap becomes a real XSS vector.

**Fix:**

```js
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

---

### WR-02: `loadSchema` has no error handling — unhandled rejection and broken UI on failure

**File:** `backend/public/index.html:567-591`

**Issue:** `loadSchema` is an `async` function with no try/catch and no `res.ok` check. If `/api/schema` returns a non-2xx response or a network error occurs, the promise rejects and produces an unhandled rejection in the browser. The schema container is left showing "Loading…" indefinitely with no user feedback. Additionally, if the response body is not valid JSON (e.g., HTML error page from the server), `res.json()` throws and the page silently breaks.

**Fix:**

```js
async function loadSchema() {
  try {
    const res = await fetch('/api/schema');
    if (!res.ok) throw new Error(`Schema fetch failed: ${res.status}`);
    const tables = await res.json();
    // ... existing render logic
  } catch (err) {
    document.getElementById('schemaContainer').textContent = 'Failed to load schema.';
    console.error('loadSchema failed:', err);
  }
}
```

---

### WR-03: `badgeHtml` renders literal "null rows" for successful queries with no columns

**File:** `backend/public/index.html:755-761`

**Issue:** In `buildHistoryCard`, `rowCount` is set to `null` when `entry.columns` is empty (line 755-757). When the query succeeds but returns no columns (e.g., an INSERT/UPDATE/DELETE executed via the AI), `entry.error` is falsy so the `else` branch of `badgeHtml` runs, producing `"null rows"` in the badge (because `null + " row"` is `"null row"` and `null !== 1` makes it `"null rows"`).

```js
const rowCount = (entry.columns && entry.columns.length > 0)
  ? entry.rows.length
  : null;

// When entry.error is null and rowCount is null:
'<span class="card-badge">' + null + ' rows</span>'
// renders as: "null rows"
```

**Fix:**

```js
const rowCount = (entry.columns && entry.columns.length > 0)
  ? entry.rows.length
  : 0;
// Or display a different badge: "0 rows" or "No rows"
const badgeHtml = entry.error
  ? '<span class="card-badge error">Error</span>'
  : '<span class="card-badge">' + rowCount + ' row' + (rowCount !== 1 ? 's' : '') + '</span>';
```

---

### WR-04: `loadHistory` does not check `res.ok` — server errors silently leave feed empty

**File:** `backend/public/index.html:791-793`

**Issue:** `loadHistory` does not check `res.ok` before calling `res.json()`. A 4xx/5xx response with a non-JSON body causes `res.json()` to throw, which is caught and only logged — the user sees no error. A 4xx/5xx response with a JSON body (e.g., `{"error":"..."}`) will be parsed as an array, and `entries.length` will be undefined or 0, silently showing the empty state when history actually exists.

**Fix:**

```js
const res = await fetch('/api/history');
if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
const entries = await res.json();
```

---

### WR-05: Dead assignment — `feed.innerHTML` is assigned twice consecutively in `clearHistory`

**File:** `backend/public/index.html:808-809`

**Issue:** `feed.innerHTML = ''` on line 808 is immediately overwritten by `feed.innerHTML = '<div class="empty-state">...'` on line 809. The first assignment has no effect — it forces an immediate DOM reparse and repaint for nothing, then throws it away.

**Fix:** Remove the redundant line 808:

```js
// Remove this line:
feed.innerHTML = '';
// Keep only:
feed.innerHTML = '<div class="empty-state">...</div>';
```

---

## Info

### IN-01: `history-card-header` is not keyboard accessible

**File:** `backend/public/index.html:769-784`

**Issue:** The history card header acts as an interactive control (click to expand/collapse) but is rendered as a `<div>`. It has `cursor: pointer` in CSS and an `onclick` handler but no `role="button"` and no `tabindex="0"`, so keyboard users cannot Tab to it or activate it with Enter/Space. This fails WCAG 2.1 SC 2.1.1 (Keyboard).

**Fix:**

```js
'<div class="history-card-header"' +
  ' role="button"' +
  ' tabindex="0"' +
  ' aria-expanded="' + String(!!expanded) + '"' +
  ' aria-label="Toggle result"' +
  ' onclick="..."' +
  ' onkeydown="if(event.key===\'Enter\'||event.key===\' \')this.click()">'
```

---

### IN-02: `copyText` does not handle clipboard permission denial

**File:** `backend/public/index.html:716-719`

**Issue:** `navigator.clipboard.writeText(text)` returns a Promise that is not awaited and not caught. In browsers where clipboard access requires permission (or is blocked in non-HTTPS contexts), the write silently fails while the button still shows "Copied!", misleading the user.

**Fix:**

```js
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy'), 1500);
  }).catch(() => {
    btn.textContent = 'Failed';
    setTimeout(() => (btn.textContent = 'Copy'), 1500);
  });
}
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
