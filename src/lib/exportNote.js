const UNTITLED = 'Untitled note';
// AC-5.4: default file name when the title has no usable characters.
const UNTITLED_FILE = 'Untitled_note';
const MAX_FILE_NAME_LENGTH = 100;

// Characters outside Latin-1 that the PDF's built-in Helvetica font can still draw (Windows-1252).
const WINDOWS_1252_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

function stripControlCharacters(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '');
}

// AC-5.4: replace OS-unsafe characters (/ \ : * ? " < > |) with underscores.
// A title with nothing left but underscores, dots or spaces falls back to Untitled_note.
export function sanitizeFileName(title) {
  const cleaned = (title ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILE_NAME_LENGTH)
    .replace(/[. ]+$/, ''); // Windows rejects names ending in a dot or space.
  return /[^_.\s]/.test(cleaned) ? cleaned : UNTITLED_FILE;
}

// AC-5.1: export needs at least a title or some body text.
export function canExportNote(note) {
  return Boolean(note && (note.title.trim() || note.content.trim()));
}

function formatCreatedDate(note) {
  const timestamp = note.createdAt ?? note.updatedAt;
  if (!timestamp) return '';
  const date = new Date(timestamp).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return `Created ${date}`;
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function replaceUnsupportedPdfCharacters(text) {
  let replaced = 0;
  const safe = Array.from(text, (character) => {
    const supported = character.codePointAt(0) <= 0xff || WINDOWS_1252_EXTRAS.includes(character);
    if (supported) return character;
    replaced += 1;
    return '?';
  }).join('');
  return { safe, replaced };
}

// AC-5.2 PDF layout: 18pt bold title, 10pt gray created date, 12pt regular wrapped body.
const PDF = {
  margin: 56,
  titleSize: 18,
  titleLineHeight: 22,
  dateSize: 10,
  dateLineHeight: 14,
  dateColor: 107, // gray, matches #6B6B6B
  bodySize: 12,
  bodyLineHeight: 16.8, // 1.4 line spacing
  paragraphGap: 6,
};

export async function exportNoteAsPdf(note) {
  if (!canExportNote(note)) throw new Error('Nothing to export');
  const { jsPDF } = await import('jspdf');
  const title = replaceUnsupportedPdfCharacters(stripControlCharacters(note.title).trim() || UNTITLED);
  const content = replaceUnsupportedPdfCharacters(stripControlCharacters(note.content));

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const textWidth = doc.internal.pageSize.getWidth() - PDF.margin * 2;
  let y = PDF.margin;

  const writeLines = (lines, lineHeight) => {
    lines.forEach((line) => {
      if (y + lineHeight > pageHeight - PDF.margin) {
        doc.addPage();
        y = PDF.margin;
      }
      doc.text(line, PDF.margin, y, { baseline: 'top' });
      y += lineHeight;
    });
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF.titleSize);
  doc.setTextColor(0);
  writeLines(doc.splitTextToSize(title.safe, textWidth), PDF.titleLineHeight);

  const created = formatCreatedDate(note);
  if (created) {
    y += 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(PDF.dateSize);
    doc.setTextColor(PDF.dateColor);
    writeLines([created], PDF.dateLineHeight);
  }
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF.bodySize);
  doc.setTextColor(0);
  content.safe.split('\n').forEach((paragraph) => {
    const lines = paragraph.trim() ? doc.splitTextToSize(paragraph, textWidth) : [''];
    writeLines(lines, PDF.bodyLineHeight);
    if (paragraph.trim()) y += PDF.paragraphGap;
  });

  const fileName = `${sanitizeFileName(note.title)}.pdf`;
  triggerDownload(doc.output('blob'), fileName);
  return { fileName, replacedCharacters: title.replaced + content.replaced };
}

// AC-5.3: Heading 1 title, gray created date, then one Word paragraph per line of the note.
export async function exportNoteAsDocx(note) {
  if (!canExportNote(note)) throw new Error('Nothing to export');
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const title = stripControlCharacters(note.title).trim() || UNTITLED;
  const created = formatCreatedDate(note);
  const body = stripControlCharacters(note.content)
    .split('\n')
    .map(
      (line) =>
        new Paragraph({
          spacing: { after: 120, line: 336 }, // 6pt after, 1.4 line spacing
          children: [new TextRun({ text: line, size: 24 })], // 12pt
        }),
    );

  const doc = new Document({
    title,
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: title, bold: true, size: 36 })], // 18pt
          }),
          ...(created
            ? [
                new Paragraph({
                  spacing: { after: 240 },
                  children: [new TextRun({ text: created, size: 20, color: '6B6B6B' })], // 10pt gray
                }),
              ]
            : []),
          ...body,
        ],
      },
    ],
  });

  const fileName = `${sanitizeFileName(note.title)}.docx`;
  triggerDownload(await Packer.toBlob(doc), fileName);
  return { fileName, replacedCharacters: 0 };
}
