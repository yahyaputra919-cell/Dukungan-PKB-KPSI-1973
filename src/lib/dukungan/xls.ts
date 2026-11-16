import type { OfficialRow } from "./types";

function xml(value: string): string {
  return value
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function cell(value: string, header = false): string {
  const style = header ? ` ss:StyleID="head"` : "";
  return `<Cell${style}><Data ss:Type="String">${xml(value)}</Data></Cell>`;
}

/** SpreadsheetML yang dibuka Excel. Tanda tangan ada di lampiran cetak, bukan di sel. */
export function buildSupportXls(rows: OfficialRow[]): string {
  const headers = [
    "No",
    "Nama",
    "NIK",
    "Toko",
    "Jabatan",
    "Tanda Tangan",
    "Tanggal",
    "Status",
    "Bersedia menjadi anggota",
  ];
  const body = rows
    .map((row, index) => {
      const values = [
        String(index + 1),
        row.fullName,
        row.nik,
        row.storeName,
        row.positionName,
        "Ada, lihat lampiran PDF",
        row.at,
        row.status === "verified" ? "Sudah dicek" : "Belum dicek",
        row.consentMember ? "Ya" : "Tidak",
      ];
      return `<Row>${values.map((value) => cell(value)).join("")}</Row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="head"><Font ss:Bold="1"/></Style>
</Styles>
<Worksheet ss:Name="Dukungan PKB">
<Table>
<Row>${headers.map((header) => cell(header, true)).join("")}</Row>
${body}
</Table>
</Worksheet>
</Workbook>`;
}
