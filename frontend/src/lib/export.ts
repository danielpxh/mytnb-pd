export type ExportFormat = "csv" | "xlsx" | "docx" | "pdf";
export type ExportValue = string | number | boolean | null | undefined;

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export type ExportRow = Record<string, ExportValue>;

function baseFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

function exportFilename(filename: string, format: ExportFormat) {
  return `${baseFilename(filename)}-${crypto.randomUUID()}.${format}`;
}

function csvCell(value: ExportValue) {
  if (typeof value === "number") return String(value);
  const text = value == null ? "" : String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportData(
  format: ExportFormat,
  filename: string,
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[],
) {
  const outputFilename = exportFilename(filename, format);
  const values = rows.map((row) => columns.map(({ key }) => row[key] ?? ""));

  if (format === "csv") {
    const csvRows = [
      columns.map(({ header }) => header),
      ...values,
    ];
    const csv = csvRows
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    downloadBlob(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      outputFilename,
    );
    return;
  }

  if (format === "xlsx") {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title.slice(0, 31));
    worksheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width ?? Math.max(column.header.length + 2, 14),
    }));
    worksheet.addRows(rows);
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      outputFilename,
    );
    return;
  }

  if (format === "docx") {
    const {
      Document,
      Packer,
      Paragraph,
      Table,
      TableCell,
      TableRow,
      TextRun,
    } =
      await import("docx");
    const tableRows = [
      new TableRow({
        tableHeader: true,
        children: columns.map(
          ({ header }) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: header, bold: true })],
                }),
              ],
            }),
        ),
      }),
      ...values.map(
        (row) =>
          new TableRow({
            children: row.map(
              (value) =>
                new TableCell({
                  children: [new Paragraph(String(value))],
                }),
            ),
          }),
      ),
    ];
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: title, heading: "Heading1" }),
            new Table({ rows: tableRows }),
          ],
        },
      ],
    });
    downloadBlob(await Packer.toBlob(document), outputFilename);
    return;
  }

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const document = new jsPDF({
    orientation: columns.length > 4 ? "landscape" : "portrait",
  });
  document.setFontSize(15);
  document.text(title, 14, 16);
  autoTable(document, {
    startY: 22,
    head: [columns.map(({ header }) => header)],
    body: values.map((row) => row.map((value) => String(value))),
    styles: { fontSize: columns.length > 4 ? 8 : 10 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  document.save(outputFilename);
}
