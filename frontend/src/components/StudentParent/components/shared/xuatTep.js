import { formatDate, todayISO } from './dinhDang.js';

function downloadBlob(filename, content, mimeType) {
  const objectUrl = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

// Kết xuất chữ tiếng Việt bằng canvas rồi đóng gói thành PDF, không cần máy chủ.
export function downloadPdfReport(filename, title, lines) {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754;
  const canvasContext = canvas.getContext('2d');
  const pages = [];
  let position = 0;
  function startPage() {
    canvasContext.fillStyle = '#ffffff';
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    canvasContext.fillStyle = '#167c83';
    canvasContext.font = 'bold 28px Arial';
    canvasContext.fillText('NEKO EDU · STUDENT / PARENT', 84, 90);
    canvasContext.fillStyle = '#203445';
    canvasContext.font = 'bold 32px Arial';
    canvasContext.fillText(title.slice(0, 65), 84, 155);
    canvasContext.font = '22px Arial';
    canvasContext.fillStyle = '#4c6274';
    canvasContext.fillText('DỮ LIỆU MẪU · Chỉ dùng để minh họa giao diện', 84, 200);
    position = 275;
    canvasContext.fillStyle = '#203445';
    canvasContext.font = '25px Arial';
  }
  function savePage() {
    canvasContext.font = '19px Arial';
    canvasContext.fillStyle = '#4c6274';
    canvasContext.fillText(`${formatDate(todayISO())}  ·  Trang ${pages.length + 1}`, 84, 1685);
    const imageData = atob(canvas.toDataURL('image/jpeg', 0.94).split(',')[1]);
    pages.push(Uint8Array.from(imageData, (character) => character.charCodeAt(0)));
  }
  startPage();
  for (const content of lines) {
    for (const paragraph of String(content ?? '').split('\n')) {
      let line = '';
      const wrappedLines = [];
      for (const word of paragraph.split(/\s+/)) {
        if (canvasContext.measureText(`${line} ${word}`).width > 1060 && line) {
          wrappedLines.push(line);
          line = word;
        } else line = `${line} ${word}`.trim();
      }
      wrappedLines.push(line);
      for (const textLine of wrappedLines) {
        if (position > 1580) {
          savePage();
          startPage();
        }
        canvasContext.fillText(textLine, 84, position);
        position += 40;
      }
      position += 12;
    }
  }
  savePage();

  const encoder = new TextEncoder();
  const chunks = [];
  const objectOffsets = [0];
  let byteLength = 0;
  const append = (content) => {
    const part = typeof content === 'string' ? encoder.encode(content) : content;
    chunks.push(part);
    byteLength += part.length;
  };
  function appendPdfObject(id, content, imageData) {
    objectOffsets[id] = byteLength;
    append(`${id} 0 obj\n${content}`);
    if (imageData) {
      append('\nstream\n');
      append(imageData);
      append('\nendstream');
    }
    append('\nendobj\n');
  }
  append('%PDF-1.4\n');
  appendPdfObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  appendPdfObject(
    2,
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] >>`
  );
  pages.forEach((imageData, index) => {
    const id = 3 + index * 3;
    const drawingCommands = encoder.encode('q 595 0 0 842 0 0 cm /Anh Do Q');
    appendPdfObject(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Anh ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`
    );
    appendPdfObject(
      id + 1,
      `<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageData.length} >>`,
      imageData
    );
    appendPdfObject(id + 2, `<< /Length ${drawingCommands.length} >>`, drawingCommands);
  });
  const xrefOffset = byteLength;
  append(`xref\n0 ${objectOffsets.length}\n0000000000 65535 f \n`);
  for (const offset of objectOffsets.slice(1))
    append(`${String(offset).padStart(10, '0')} 00000 n \n`);
  append(
    `trailer\n<< /Size ${objectOffsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );
  downloadBlob(
    filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`,
    new Blob(chunks),
    'application/pdf'
  );
}

function escapeXml(text) {
  return String(text).replace(
    /[<>&"']/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]
  );
}

// ZIP không nén với ba phần OOXML để tài liệu DOCX mẫu mở được trong Word.
function createDocx(title, content) {
  const encoder = new TextEncoder();
  const files = {
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[title, 'NEKO EDU — Tài liệu mẫu', ...String(content).split('\n')].map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`,
  };
  const chunks = [];
  const centralDirectory = [];
  let position = 0;
  for (const [name, fileContent] of Object.entries(files)) {
    const encodedFilename = encoder.encode(name);
    const bytes = encoder.encode(fileContent);
    let checksum = 0xffffffff;
    for (const value of bytes) {
      checksum ^= value;
      for (let bitIndex = 0; bitIndex < 8; bitIndex++)
        checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
    }
    checksum = (checksum ^ 0xffffffff) >>> 0;
    const localHeader = new Uint8Array(30 + encodedFilename.length);
    const headerView = new DataView(localHeader.buffer);
    headerView.setUint32(0, 0x04034b50, true);
    headerView.setUint16(4, 20, true);
    headerView.setUint32(14, checksum, true);
    headerView.setUint32(18, bytes.length, true);
    headerView.setUint32(22, bytes.length, true);
    headerView.setUint16(26, encodedFilename.length, true);
    localHeader.set(encodedFilename, 30);
    const directoryEntry = new Uint8Array(46 + encodedFilename.length);
    const entryView = new DataView(directoryEntry.buffer);
    entryView.setUint32(0, 0x02014b50, true);
    entryView.setUint16(4, 20, true);
    entryView.setUint16(6, 20, true);
    entryView.setUint32(16, checksum, true);
    entryView.setUint32(20, bytes.length, true);
    entryView.setUint32(24, bytes.length, true);
    entryView.setUint16(28, encodedFilename.length, true);
    entryView.setUint32(42, position, true);
    directoryEntry.set(encodedFilename, 46);
    centralDirectory.push(directoryEntry);
    chunks.push(localHeader, bytes);
    position += localHeader.length + bytes.length;
  }
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centralDirectory.length, true);
  endView.setUint16(10, centralDirectory.length, true);
  endView.setUint32(
    12,
    centralDirectory.reduce((total, directoryEntry) => total + directoryEntry.length, 0),
    true
  );
  endView.setUint32(16, position, true);
  return new Blob([...chunks, ...centralDirectory, endRecord]);
}

export function downloadMaterial(file) {
  if (file.duongDan) {
    const link = document.createElement('a');
    link.href = file.duongDan;
    link.download = file.ten;
    link.click();
  } else if (file.loai === 'DOCX') {
    downloadBlob(
      file.ten,
      createDocx(file.ten, file.noiDung),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  } else {
    downloadPdfReport(
      file.ten.replace(/\.[^.]+$/, '.pdf'),
      file.ten,
      String(file.noiDung || 'Tài liệu học tập mẫu của NEKO EDU.').split('\n')
    );
  }
}

export function exportCalendar(sessions, courses) {
  const escapeCalendarText = (text) =>
    String(text)
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/[,;]/g, (character) => `\\${character}`);
  const formatCalendarTimestamp = (date, time) =>
    new Date(`${date}T${time}:00+07:00`)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NEKO EDU//Student Parent Demo//VI',
    'CALSCALE:GREGORIAN',
  ];
  for (const session of sessions.filter((session) => session.trangThai !== 'daHuy')) {
    const course = courses.find((course) => course.ma === session.maKhoa);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${session.ma}@neko-demo.local`,
      `DTSTAMP:${formatCalendarTimestamp(todayISO(), '00:00')}`,
      `DTSTART:${formatCalendarTimestamp(session.ngay, session.batDau)}`,
      `DTEND:${formatCalendarTimestamp(session.ngay, session.ketThuc)}`,
      `SUMMARY:${escapeCalendarText(course?.ten || 'Buổi học')}`,
      `LOCATION:${escapeCalendarText(session.phong)}`,
      `DESCRIPTION:${escapeCalendarText(`Dữ liệu mẫu. ${session.giangVien}. ${session.noiDung}`)}`,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  const foldedCalendar = lines
    .map((line) => {
      // Dòng ICS dài được gấp bằng CRLF + dấu cách theo định dạng iCalendar.
      const characters = [...line];
      const segments = [];
      while (characters.length) segments.push(characters.splice(0, 24).join(''));
      return segments.join('\r\n ');
    })
    .join('\r\n');
  downloadBlob('lich-hoc-neko-mau.ics', `${foldedCalendar}\r\n`, 'text/calendar;charset=utf-8');
}
