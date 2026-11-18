/** Client-side export helpers for analysis results. */

function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(escapeCsvCell).join(",");
  const body = rows.map((row) => columns.map((col) => escapeCsvCell(row[col])).join(","));
  return [header, ...body].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json");
}

export function riskJoinedCsv(joinedTable: Record<string, unknown>[]): string {
  if (joinedTable.length === 0) {
    return "";
  }
  const columns = [
    "risk_id",
    "risk_category",
    "risk_description",
    "risk_score",
    "rmf_function",
    "rmf_category",
    "rmf_recommendation",
    "rmf_relevance_score",
  ];
  return rowsToCsv(joinedTable, columns);
}

export function buildRiskJoinedTable(
  risks: Record<string, unknown>[],
  rmfByRisk: Record<string, Record<string, unknown>[]>,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const risk of risks) {
    const riskId = String(risk.id ?? risk.risk_id ?? "");
    const recs = rmfByRisk[riskId] ?? [];
    if (recs.length === 0) {
      rows.push({
        risk_id: riskId,
        risk_category: risk.category ?? "",
        risk_description: risk.description ?? risk.text ?? "",
        risk_score: risk.score ?? "",
        rmf_function: "",
        rmf_category: "",
        rmf_recommendation: "",
        rmf_relevance_score: "",
      });
      continue;
    }
    for (const rmf of recs) {
      rows.push({
        risk_id: riskId,
        risk_category: risk.category ?? "",
        risk_description: risk.description ?? risk.text ?? "",
        risk_score: risk.score ?? "",
        rmf_function: rmf.function ?? "",
        rmf_category: rmf.category ?? "",
        rmf_recommendation: rmf.recommendation ?? rmf.text ?? rmf.action ?? "",
        rmf_relevance_score: rmf.relevance_score ?? rmf.score ?? "",
      });
    }
  }
  return rows;
}

export function biasInstancesCsv(instances: Record<string, unknown>[]): string {
  const columns = ["type", "severity", "text_span", "explanation"];
  const rows = instances.map((i) => ({
    type: i.type ?? "",
    severity: i.severity ?? "",
    text_span: i.text_span ?? i.text ?? "",
    explanation: i.explanation ?? i.reason ?? "",
  }));
  return rowsToCsv(rows, columns);
}

export function batchResultsJson(results: unknown[]): string {
  return JSON.stringify({ results }, null, 2);
}

/** Parse a simple scenario CSV (header: scenario|content|text|description, or single column). */
export function parseScenarioCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }
  const splitRow = (line: string): string[] => {
    if (!line.includes('"')) {
      return line.split(",").map((c) => c.trim());
    }
    const cells: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
        continue;
      }
      if (ch === "," && !inQuote) {
        cells.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  const header = splitRow(lines[0]).map((h) => h.toLowerCase());
  const colNames = ["scenario", "content", "text", "description"];
  const colIdx = header.findIndex((h) => colNames.includes(h));
  const start = colIdx >= 0 ? 1 : 0;
  const useCol = colIdx >= 0 ? colIdx : 0;
  const scenarios: string[] = [];
  for (const line of lines.slice(start)) {
    const cells = splitRow(line);
    const cell = cells[useCol] ?? "";
    if (cell.length > 0) {
      scenarios.push(cell);
    }
  }
  return scenarios;
}

export function flattenBatchRiskCsv(results: unknown[]): string {
  const rows: Record<string, unknown>[] = [];
  let batchIndex = 0;
  for (const item of results) {
    const r = item as {
      workflow_id?: string;
      risk_result?: { joined_table?: Record<string, unknown>[]; risks?: unknown[]; rmf_recommendations?: Record<string, Record<string, unknown>[]> };
    };
    if (r.workflow_id !== "risk" || !r.risk_result) {
      batchIndex += 1;
      continue;
    }
    const joined =
      r.risk_result.joined_table?.length
        ? r.risk_result.joined_table
        : buildRiskJoinedTable(
            (r.risk_result.risks ?? []) as Record<string, unknown>[],
            r.risk_result.rmf_recommendations ?? {},
          );
    for (const row of joined) {
      rows.push({ batch_item: batchIndex + 1, ...row });
    }
    batchIndex += 1;
  }
  if (rows.length === 0) {
    return "";
  }
  const columns = [
    "batch_item",
    "risk_id",
    "risk_category",
    "risk_description",
    "risk_score",
    "rmf_function",
    "rmf_category",
    "rmf_recommendation",
    "rmf_relevance_score",
  ];
  return rowsToCsv(rows, columns);
}

export function dedupeRiskHits(risks: Record<string, unknown>[], limit = 5): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const risk of risks) {
    const id = String(risk.id ?? risk.risk_id ?? "");
    const score = Number(risk.score ?? 0);
    if (!id) {
      continue;
    }
    const prev = byId.get(id);
    if (!prev || score > Number(prev.score ?? 0)) {
      byId.set(id, risk);
    }
  }
  let candidates = Array.from(byId.values());
  if (candidates.length === 0) {
    candidates = [...risks];
  }
  candidates.sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
  const byCategory = new Map<string, Record<string, unknown>>();
  const ordered: Record<string, unknown>[] = [];
  for (const risk of candidates) {
    const cat = String(risk.category ?? "")
      .trim()
      .toLowerCase();
    const key = cat || String(risk.id ?? risk.risk_id ?? ordered.length);
    if (byCategory.has(key)) {
      continue;
    }
    byCategory.set(key, risk);
    ordered.push(risk);
    if (ordered.length >= limit) {
      break;
    }
  }
  return ordered;
}
