const UNTITLED = 'Untitled note';

// Characters outside Latin-1 that the PDF's built-in Helvetica font can still draw (Windows-1252).
const WINDOWS_1252_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

function stripControlCharacters(text) {
  return text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '');
}

function fileBaseName(title) {
  return title.replace(/[\\/:*?"<>|\s]+/g, ' ').trim() || UNTITLED;
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

export async function exportNoteAsPdf(note) {
  const { jsPDF } = await import('jspdf');
  const title = replaceUnsupportedPdfCharacters(stripControlCharacters(note.title).trim() || UNTITLED);
  const content = replaceUnsupportedPdfCharacters(stripControlCharacters(note.content));

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 56;
  const pageHeight = doc.internal.pageSize.getHeight();
  const textWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const writeLines = (lines, lineHeight) => {
    lines.forEach((line) => {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y, { baseline: 'top' });
      y += lineHeight;
    });
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  writeLines(doc.splitTextToSize(title.safe, textWidth), 24);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  writeLines(doc.splitTextToSize(content.safe, textWidth), 16);

  const fileName = `${fileBaseName(note.title)}.pdf`;
  triggerDownload(doc.output('blob'), fileName);
  return { fileName, replacedCharacters: title.replaced + content.replaced };
}

export async function exportNoteAsDocx(note) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const title = stripControlCharacters(note.title).trim() || UNTITLED;
  const paragraphs = stripControlCharacters(note.content)
    .split('\n')
    .map((line) => new Paragraph({ children: [new TextRun(line)] }));

  const doc = new Document({
    sections: [
      {
        children: [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }), ...paragraphs],
      },
    ],
  });

  const fileName = `${fileBaseName(note.title)}.docx`;
  triggerDownload(await Packer.toBlob(doc), fileName);
  return { fileName, replacedCharacters: 0 };
}
