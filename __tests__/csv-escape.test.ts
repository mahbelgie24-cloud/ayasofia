import { describe, it, expect } from "vitest";
import { escapeCsvCell, rowsToCsv } from "@/lib/security/csv-escape";

/**
 * CSV formula-injection (a.k.a. CSV injection, CWE-1236) regression tests.
 *
 * A user-text cell that begins with `=`, `+`, `-`, `@`, TAB, or CR is
 * interpreted as a formula by Excel / LibreOffice / Google Sheets when
 * the file is opened. The injected expression runs in the spreadsheet's
 * evaluation context and can:
 *   - leak session cookies via `=HYPERLINK(...)`
 *   - exfiltrate files via `=DDE(...)`
 *   - call out to attacker URLs via `=WEBSERVICE(...)`
 *   - auto-run on file open (the leading `=` is the signal)
 *
 * These tests pin the mitigation: any cell beginning with one of those
 * characters must be prefixed with a single quote so the spreadsheet
 * treats the value as a literal string.
 */
describe("escapeCsvCell — formula injection mitigation", () => {
  it("prefixes '=' with a single quote", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
  });

  it("prefixes '+' with a single quote", () => {
    expect(escapeCsvCell("+972591234567")).toBe("'+972591234567");
  });

  it("prefixes '-' with a single quote (negative-cell attack vector)", () => {
    expect(escapeCsvCell("-2+3+cmd|'/c calc'!A1")).toBe("'-2+3+cmd|'/c calc'!A1");
  });

  it("prefixes '@' with a single quote", () => {
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("prefixes TAB with a single quote", () => {
    expect(escapeCsvCell("\tINJECT")).toBe("'\tINJECT");
  });

  it("prefixes CR with a single quote (and also quotes per RFC 4180)", () => {
    // CR triggers BOTH mitigations: the formula-injection prefix and the
    // RFC 4180 quote-wrapping (CR is a cell-boundary special char).
    // The test pins both — if either regression silently reverts, the
    // cell becomes evaluable as a formula again.
    const out = escapeCsvCell("\rINJECT");
    expect(out).toBe('"\'\rINJECT"');
  });

  it("does not prefix benign values", () => {
    expect(escapeCsvCell("Ayasofia Sweet")).toBe("Ayasofia Sweet");
    expect(escapeCsvCell("محمد أحمد")).toBe("محمد أحمد");
    expect(escapeCsvCell("حلويات")).toBe("حلويات");
    expect(escapeCsvCell("123 Main St")).toBe("123 Main St");
  });

  it("escapes internal double-quote per RFC 4180", () => {
    expect(escapeCsvCell('She said "hi"')).toBe('"She said ""hi"""');
  });

  it("wraps in quotes when a comma is present (RFC 4180)", () => {
    expect(escapeCsvCell("Qalqilya, West Bank")).toBe('"Qalqilya, West Bank"');
  });

  it("wraps in quotes when a newline is present", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("returns empty string for null and undefined", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("coerces numbers without escaping when numeric flag is set", () => {
    expect(escapeCsvCell("15.00", { numeric: true })).toBe("15.00");
    expect(escapeCsvCell(0, { numeric: true })).toBe("0");
    expect(escapeCsvCell("1234.5", { numeric: true })).toBe("1234.5");
  });

  it("still escapes formula-injection when numeric flag is set but value starts with '='", () => {
    // Caller said "numeric" but value is "=15" — still dangerous, escape it.
    expect(escapeCsvCell("=15", { numeric: true })).toBe("'=15");
  });

  it("does not double-escape non-formula non-numeric values (the caller opted out of text escaping)", () => {
    // When the caller labels a value "numeric" but it's not actually
    // numeric AND it's not a formula (e.g. "not-a-number"), the function
    // returns it as-is. This is intentional: the caller is declaring
    // "I know this value, leave it alone" — and a string that starts
    // with a letter, not a formula char, is not a CSV-context attack.
    // The right defense for "value isn't a number" is at the data
    // validation layer, not at the CSV serializer.
    expect(escapeCsvCell("not-a-number", { numeric: true })).toBe("not-a-number");
  });

  it("escapes the OWASP reference payload end-to-end", () => {
    const payload = "=cmd|'/c calc'!A1";
    const escaped = escapeCsvCell(payload);
    expect(escaped.startsWith("=")).toBe(false);
    expect(escaped).toBe("'" + payload);
  });
});

describe("rowsToCsv — full export", () => {
  it("emits a header + body lines joined with CRLF", () => {
    const csv = rowsToCsv(
      [{ name: "A", qty: 1 }],
      [
        { key: "name", header: "Name" },
        { key: "qty", header: "Qty", numeric: true },
      ],
    );
    expect(csv).toBe("Name,Qty\r\nA,1\r\n");
  });

  it("escapes formula-injection in row data", () => {
    const csv = rowsToCsv(
      [
        { name: "=cmd|'/c calc'!A1", note: "@SUM(A1)" },
        { name: "محمد", note: "ملاحظة عادية" },
      ],
      [
        { key: "name", header: "Name" },
        { key: "note", header: "Note" },
      ],
    );
    const lines = csv.split("\r\n");
    // Header
    expect(lines[0]).toBe("Name,Note");
    // First row — both fields must be prefixed with the single-quote
    // mitigation so the spreadsheet will not evaluate them as formulas.
    expect(lines[1]).toBe("'=cmd|'/c calc'!A1,'@SUM(A1)");
    // Second row — benign Arabic content must pass through unchanged.
    expect(lines[2]).toBe("محمد,ملاحظة عادية");
  });

  it("escapes the header line too (defense-in-depth)", () => {
    // The full CSV is `'<header>,<body>...` — the header is column 0 of
    // row 0, so it must be the first cell after the formula prefix.
    const csv = rowsToCsv([{ a: 1 }], [{ key: "a", header: "=evil" }]);
    expect(csv.split("\r\n")[0]).toBe("'=evil");
  });

  it("renders an empty body when there are no rows", () => {
    const csv = rowsToCsv([], [{ key: "a", header: "A" }]);
    expect(csv).toBe("A\r\n");
  });
});
