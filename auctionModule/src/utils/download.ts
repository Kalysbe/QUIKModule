export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob(['\uFEFF', content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
}

export function downloadCsv(rows: Array<Array<string | number>>, filename: string) {
  downloadTextFile(buildCsv(rows), filename, 'text/csv;charset=utf-8');
}
