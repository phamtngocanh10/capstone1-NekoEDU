import { dinhdangngay, ngayhomnay } from './dinhdang.js';

function taiblob(tentep, noidung, loai) {
  const diachi = URL.createObjectURL(new Blob([noidung], { type: loai }));
  const lienket = document.createElement('a');
  lienket.href = diachi;
  lienket.download = tentep;
  lienket.click();
  setTimeout(() => URL.revokeObjectURL(diachi), 1000);
}

// Kết xuất chữ tiếng Việt bằng canvas rồi đóng gói thành PDF, không cần máy chủ.
export function taibaocaopdf(tentep, tieude, cacdong) {
  const khung = document.createElement('canvas');
  khung.width = 1240;
  khung.height = 1754;
  const but = khung.getContext('2d');
  const cactrang = [];
  let vitri = 0;
  function batdautrang() {
    but.fillStyle = '#ffffff';
    but.fillRect(0, 0, khung.width, khung.height);
    but.fillStyle = '#167c83';
    but.font = 'bold 28px Arial';
    but.fillText('NEKO EDU · STUDENT / PARENT', 84, 90);
    but.fillStyle = '#203445';
    but.font = 'bold 32px Arial';
    but.fillText(tieude.slice(0, 65), 84, 155);
    but.font = '22px Arial';
    but.fillStyle = '#4c6274';
    but.fillText('DỮ LIỆU MẪU · Chỉ dùng để minh họa giao diện', 84, 200);
    vitri = 275;
    but.fillStyle = '#203445';
    but.font = '25px Arial';
  }
  function luutrang() {
    but.font = '19px Arial';
    but.fillStyle = '#4c6274';
    but.fillText(`${dinhdangngay(ngayhomnay())}  ·  Trang ${cactrang.length + 1}`, 84, 1685);
    const anh = atob(khung.toDataURL('image/jpeg', 0.94).split(',')[1]);
    cactrang.push(Uint8Array.from(anh, (kytu) => kytu.charCodeAt(0)));
  }
  batdautrang();
  for (const noidung of cacdong) {
    for (const doan of String(noidung ?? '').split('\n')) {
      let dong = '';
      const cacdongvanban = [];
      for (const tu of doan.split(/\s+/)) {
        if (but.measureText(`${dong} ${tu}`).width > 1060 && dong) {
          cacdongvanban.push(dong);
          dong = tu;
        } else dong = `${dong} ${tu}`.trim();
      }
      cacdongvanban.push(dong);
      for (const dongchu of cacdongvanban) {
        if (vitri > 1580) {
          luutrang();
          batdautrang();
        }
        but.fillText(dongchu, 84, vitri);
        vitri += 40;
      }
      vitri += 12;
    }
  }
  luutrang();

  const mahoa = new TextEncoder();
  const cacphan = [];
  const vitridoituong = [0];
  let dodai = 0;
  const them = (noidung) => {
    const phan = typeof noidung === 'string' ? mahoa.encode(noidung) : noidung;
    cacphan.push(phan);
    dodai += phan.length;
  };
  function doituong(ma, noidung, anh) {
    vitridoituong[ma] = dodai;
    them(`${ma} 0 obj\n${noidung}`);
    if (anh) {
      them('\nstream\n');
      them(anh);
      them('\nendstream');
    }
    them('\nendobj\n');
  }
  them('%PDF-1.4\n');
  doituong(1, '<< /Type /Catalog /Pages 2 0 R >>');
  doituong(
    2,
    `<< /Type /Pages /Count ${cactrang.length} /Kids [${cactrang.map((_, chiso) => `${3 + chiso * 3} 0 R`).join(' ')}] >>`
  );
  cactrang.forEach((anh, chiso) => {
    const ma = 3 + chiso * 3;
    const lenhve = mahoa.encode('q 595 0 0 842 0 0 cm /Anh Do Q');
    doituong(
      ma,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Anh ${ma + 1} 0 R >> >> /Contents ${ma + 2} 0 R >>`
    );
    doituong(
      ma + 1,
      `<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${anh.length} >>`,
      anh
    );
    doituong(ma + 2, `<< /Length ${lenhve.length} >>`, lenhve);
  });
  const vitribang = dodai;
  them(`xref\n0 ${vitridoituong.length}\n0000000000 65535 f \n`);
  for (const moc of vitridoituong.slice(1)) them(`${String(moc).padStart(10, '0')} 00000 n \n`);
  them(`trailer\n<< /Size ${vitridoituong.length} /Root 1 0 R >>\nstartxref\n${vitribang}\n%%EOF`);
  taiblob(
    tentep.toLowerCase().endsWith('.pdf') ? tentep : `${tentep}.pdf`,
    new Blob(cacphan),
    'application/pdf'
  );
}

function thoatxml(chuoi) {
  return String(chuoi).replace(
    /[<>&"']/g,
    (kytu) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[kytu]
  );
}

// ZIP không nén với ba phần OOXML để tài liệu DOCX mẫu mở được trong Word.
function taodocx(tieude, noidung) {
  const mahoa = new TextEncoder();
  const cactep = {
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[tieude, 'NEKO EDU — Tài liệu mẫu', ...String(noidung).split('\n')].map((dong) => `<w:p><w:r><w:t xml:space="preserve">${thoatxml(dong)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`,
  };
  const cacphan = [];
  const mucluc = [];
  let vitri = 0;
  for (const [ten, noidungtep] of Object.entries(cactep)) {
    const tenmahoa = mahoa.encode(ten);
    const dulieu = mahoa.encode(noidungtep);
    let makiemtra = 0xffffffff;
    for (const giatri of dulieu) {
      makiemtra ^= giatri;
      for (let lan = 0; lan < 8; lan++)
        makiemtra = (makiemtra >>> 1) ^ (makiemtra & 1 ? 0xedb88320 : 0);
    }
    makiemtra = (makiemtra ^ 0xffffffff) >>> 0;
    const dau = new Uint8Array(30 + tenmahoa.length);
    const doc = new DataView(dau.buffer);
    doc.setUint32(0, 0x04034b50, true);
    doc.setUint16(4, 20, true);
    doc.setUint32(14, makiemtra, true);
    doc.setUint32(18, dulieu.length, true);
    doc.setUint32(22, dulieu.length, true);
    doc.setUint16(26, tenmahoa.length, true);
    dau.set(tenmahoa, 30);
    const muc = new Uint8Array(46 + tenmahoa.length);
    const bang = new DataView(muc.buffer);
    bang.setUint32(0, 0x02014b50, true);
    bang.setUint16(4, 20, true);
    bang.setUint16(6, 20, true);
    bang.setUint32(16, makiemtra, true);
    bang.setUint32(20, dulieu.length, true);
    bang.setUint32(24, dulieu.length, true);
    bang.setUint16(28, tenmahoa.length, true);
    bang.setUint32(42, vitri, true);
    muc.set(tenmahoa, 46);
    mucluc.push(muc);
    cacphan.push(dau, dulieu);
    vitri += dau.length + dulieu.length;
  }
  const ket = new Uint8Array(22);
  const bangket = new DataView(ket.buffer);
  bangket.setUint32(0, 0x06054b50, true);
  bangket.setUint16(8, mucluc.length, true);
  bangket.setUint16(10, mucluc.length, true);
  bangket.setUint32(
    12,
    mucluc.reduce((tong, muc) => tong + muc.length, 0),
    true
  );
  bangket.setUint32(16, vitri, true);
  return new Blob([...cacphan, ...mucluc, ket]);
}

export function taitailieu(tep) {
  if (tep.duongDan) {
    const lienket = document.createElement('a');
    lienket.href = tep.duongDan;
    lienket.download = tep.ten;
    lienket.click();
  } else if (tep.loai === 'DOCX') {
    taiblob(
      tep.ten,
      taodocx(tep.ten, tep.noiDung),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  } else {
    taibaocaopdf(
      tep.ten.replace(/\.[^.]+$/, '.pdf'),
      tep.ten,
      String(tep.noiDung || 'Tài liệu học tập mẫu của NEKO EDU.').split('\n')
    );
  }
}

export function xuatlich(cacbuoihoc, cackhoahoc) {
  const thoat = (chuoi) =>
    String(chuoi)
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/[,;]/g, (kytu) => `\\${kytu}`);
  const ngaygio = (ngay, gio) =>
    new Date(`${ngay}T${gio}:00+07:00`)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const cacdong = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NEKO EDU//Student Parent Demo//VI',
    'CALSCALE:GREGORIAN',
  ];
  for (const buoi of cacbuoihoc.filter((buoi) => buoi.trangThai !== 'daHuy')) {
    const khoa = cackhoahoc.find((khoa) => khoa.ma === buoi.maKhoa);
    cacdong.push(
      'BEGIN:VEVENT',
      `UID:${buoi.ma}@neko-demo.local`,
      `DTSTAMP:${ngaygio(ngayhomnay(), '00:00')}`,
      `DTSTART:${ngaygio(buoi.ngay, buoi.batDau)}`,
      `DTEND:${ngaygio(buoi.ngay, buoi.ketThuc)}`,
      `SUMMARY:${thoat(khoa?.ten || 'Buổi học')}`,
      `LOCATION:${thoat(buoi.phong)}`,
      `DESCRIPTION:${thoat(`Dữ liệu mẫu. ${buoi.giangVien}. ${buoi.noiDung}`)}`,
      'END:VEVENT'
    );
  }
  cacdong.push('END:VCALENDAR');
  const xuongdong = cacdong
    .map((dong) => {
      // Dòng ICS dài được gấp bằng CRLF + dấu cách theo định dạng iCalendar.
      const tungkytu = [...dong];
      const cacdoan = [];
      while (tungkytu.length) cacdoan.push(tungkytu.splice(0, 24).join(''));
      return cacdoan.join('\r\n ');
    })
    .join('\r\n');
  taiblob('lich-hoc-neko-mau.ics', `${xuongdong}\r\n`, 'text/calendar;charset=utf-8');
}
