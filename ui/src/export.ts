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
