// Dữ liệu minh họa cho giao diện Trợ giảng khi chưa có API.
const STUDENT_NAMES = {
  'lop-junior-3': [
    'Lê Bảo Nam',
    'Đỗ Khánh Linh',
    'Trần Gia Hân',
    'Nguyễn Anh Khoa',
    'Phạm Bảo Châu',
    'Vũ Minh Đức',
    'Nguyễn Minh Anh',
    'Trần Gia Bảo',
    'Đỗ Minh Anh',
    'Lê Hoàng Phúc',
    'Hoàng Gia Hân',
    'Vũ Ngọc Diệp',
    'Bùi Thanh Tùng',
    'Phạm Đức Anh',
    'Mai Ngọc Nhi',
  ],
  'lop-toeic-650': [
    'Nguyễn Hoàng Long',
    'Trần Thu Trang',
    'Lê Minh Quân',
    'Phạm Ngọc Ánh',
    'Võ Đức Huy',
    'Đặng Phương Thảo',
    'Bùi Thanh Hà',
    'Ngô Quốc Bảo',
    'Đỗ Hoài An',
    'Hoàng Tuấn Kiệt',
    'Dương Khánh Vy',
    'Nguyễn Nhật Minh',
    'Trần Bảo Trân',
    'Lê Quỳnh Anh',
    'Phạm Anh Tuấn',
    'Vũ Ngọc Mai',
    'Nguyễn Thành Đạt',
    'Đinh Hồng Nhung',
    'Đỗ Gia Minh',
    'Phan Thùy Dung',
    'Trương Hải Đăng',
    'Huỳnh Phương Linh',
    'Lý Minh Khang',
    'Cao Thanh Tâm',
    'Mai Anh Thư',
  ],
  'lop-starters-a': [
    'Nguyễn Bảo An',
    'Trần Minh Khang',
    'Lê Ngọc Hân',
    'Phạm Khánh An',
    'Vũ Gia Khánh',
    'Đỗ Tuệ Nhi',
    'Bùi Anh Thư',
    'Hoàng Hải Nam',
    'Ngô Bảo Ngọc',
    'Đặng Nhật Anh',
    'Võ Minh Châu',
    'Mai Gia Bảo',
  ],
};

function getVietnamDate(timestamp) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}

function addDays(date, dayCount) {
  const result = new Date(`${date}T12:00:00+07:00`);
  result.setUTCDate(result.getUTCDate() + dayCount);
  return result.toISOString().slice(0, 10);
}

function timestampAtTime(date, time = '00:00:00') {
  return `${date}T${time}+07:00`;
}

function createStudents(classItem, currentYear) {
  return STUDENT_NAMES[classItem.id].map((name, index) => ({
    id: `hv-${classItem.groupCode}-${String(index + 1).padStart(3, '0')}`,
    code: `${classItem.studentCodePrefix}${String(index + 1).padStart(3, '0')}`,
    name,
    birth: `${String((index % 27) + 1).padStart(2, '0')}/${String((index % 12) + 1).padStart(2, '0')}/${currentYear - classItem.age}`,
    phone: `090${String(1000000 + classItem.phoneNumberOffset + index)}`,
    rate: index % 5 === 0 ? 88 : index % 3 === 0 ? 94 : 100,
  }));
}

function createGradeRows(studentList, fillAllScores = false) {
  const sampleScores = [
    [7.5, 6.5, 6, 6.5],
    [6, 6.5, 5.5, 6],
    [7, 7.5, 6.5, 7],
    [6.5, 6, 6, 6.5],
    [7.5, 7, 7, 7.5],
  ];
  return studentList.map((student, index) => ({
    studentId: student.id,
    scores:
      fillAllScores || index < 5
        ? [...sampleScores[index % sampleScores.length]]
        : index === 5
          ? [6.5, 7.5, '', '']
          : ['', '', '', ''],
    note: '',
  }));
}

export function createDemoData(referenceDate = new Date()) {
  const today = getVietnamDate(referenceDate);
  const currentWeekday = new Date(`${today}T12:00:00+07:00`).getUTCDay();
  const weekStart = addDays(today, -((currentWeekday + 6) % 7));
  const relativeTimestamp = (minutes) =>
    new Date(referenceDate.getTime() + minutes * 60000).toISOString();
  const periodOpensAt = timestampAtTime(weekStart);
  const periodClosesAt = timestampAtTime(addDays(weekStart, 13), '23:59:59');
  const classes = [
    {
      id: 'lop-junior-3',
      name: 'Giao tiếp Junior 3',
      code: 'JUNIOR-03',
      course: 'Giao tiếp Junior',
      courseId: 'junior',
      teacher: 'Cô Phạm Thu Hà',
      lecturerId: 'gv-thuha',
      room: 'P.105',
      size: 15,
      cap: 18,
      days: [0, 2, 4],
      time: '09:00-10:30',
      groupCode: 'junior',
      studentCodePrefix: 'JR',
      age: 12,
      phoneNumberOffset: 0,
    },
    {
      id: 'lop-toeic-650',
      name: 'TOEIC 650+',
      code: 'TOEIC-650',
      course: 'Luyện thi TOEIC',
      courseId: 'toeic',
      teacher: 'Thầy Lê Anh Dũng',
      lecturerId: 'gv-anhdung',
      room: 'P.301',
      size: 25,
      cap: 28,
      days: [0, 3],
      time: '14:00-15:30',
      groupCode: 'toeic',
      studentCodePrefix: 'TC',
      age: 21,
      phoneNumberOffset: 100,
    },
    {
      id: 'lop-starters-a',
      name: 'Starters Kids A',
      code: 'STARTERS-A',
      course: 'Cambridge Starters',
      courseId: 'starters',
      teacher: 'Cô Phạm Thu Hà',
      lecturerId: 'gv-thuha',
      room: 'P.108',
      size: 12,
      cap: 15,
      days: [0, 1, 4],
      time: '16:00-17:15',
      groupCode: 'starters',
      studentCodePrefix: 'ST',
      age: 8,
      phoneNumberOffset: 200,
    },
  ];
  const studentsByClass = Object.fromEntries(
    classes.map((classItem) => [classItem.id, createStudents(classItem, Number(today.slice(0, 4)))])
  );
  const classList = classes.map(
    ({ groupCode, studentCodePrefix, age, phoneNumberOffset, ...classItem }) => ({
      ...classItem,
      start: addDays(weekStart, -56),
      end: addDays(weekStart, 56),
      status: 'open',
      permissions: ['attendance', 'roster'],
      assignmentId: `phancong-${classItem.id}`,
    })
  );
  const assessments = classList.map((classItem) => ({
    id: `ky-${classItem.id}`,
    classId: classItem.id,
    assessmentId: `bai-${classItem.id}-giuaky`,
    title: 'Kiểm tra giữa kỳ',
    term: `Giữa kỳ T${Number(today.slice(5, 7))}`,
    teacher: classItem.teacher,
    opensAt: periodOpensAt,
    closesAt: periodClosesAt,
    status: 'DRAFT',
  }));
  const gradingGrants = [
    {
      id: 'quyen-junior-mo',
      classId: 'lop-junior-3',
      className: 'Giao tiếp Junior 3',
      assessmentId: 'bai-lop-junior-3-giuaky',
      title: 'Kiểm tra giữa kỳ',
      teacher: 'Cô Phạm Thu Hà',
      opensAt: periodOpensAt,
      closesAt: periodClosesAt,
      state: 'open',
      pending: false,
      submissionId: null,
    },
    {
      id: 'quyen-toeic-het-han',
      classId: 'lop-toeic-650',
      className: 'TOEIC 650+',
      assessmentId: 'bai-toeic-da-ket-thuc',
      title: 'Kiểm tra đầu vào',
      teacher: 'Thầy Lê Anh Dũng',
      opensAt: timestampAtTime(addDays(today, -7)),
      closesAt: timestampAtTime(addDays(today, -1), '23:59:59'),
      state: 'expired',
      pending: false,
      submissionId: null,
    },
    {
      id: 'quyen-starters-sap-mo',
      classId: 'lop-starters-a',
      className: 'Starters Kids A',
      assessmentId: 'bai-lop-starters-a-giuaky',
      title: 'Kiểm tra giữa kỳ',
      teacher: 'Cô Phạm Thu Hà',
      opensAt: timestampAtTime(addDays(today, 1), '08:00:00'),
      closesAt: periodClosesAt,
      state: 'scheduled',
      pending: false,
      submissionId: null,
    },
    {
      id: 'quyen-junior-cu',
      classId: 'lop-junior-3',
      className: 'Giao tiếp Junior 3',
      assessmentId: 'bai-junior-thang-truoc',
      title: 'Kiểm tra tháng trước',
      teacher: 'Cô Phạm Thu Hà',
      opensAt: timestampAtTime(addDays(today, -14)),
      closesAt: timestampAtTime(addDays(today, -7), '23:59:59'),
      state: 'expired',
      pending: false,
      submissionId: null,
    },
  ];

  const sessions = [];
  const attendanceBySession = {};
  for (let offset = -7; offset <= 13; offset += 1) {
    const date = addDays(weekStart, offset);
    const weekday = ((offset % 7) + 7) % 7;
    for (const classItem of classList) {
      // Có ba buổi hỗ trợ hôm nay, hôm qua và ngày mai để dễ thử các màn hình.
      if (
        !classItem.days.includes(weekday) &&
        ![-1, 0, 1].some((dayOffset) => date === addDays(today, dayOffset))
      )
        continue;
      const [startTime, endTime] = classItem.time.split('-');
      const sessionId = `buoi-${classItem.id}-${date}`;
      sessions.push({
        id: sessionId,
        classId: classItem.id,
        name: classItem.name,
        code: classItem.code,
        iso: date,
        time: classItem.time,
        startTime,
        endTime,
        room: classItem.room,
        teacher: classItem.teacher,
        students: classItem.size,
        sessionStatus: 'SCHEDULED',
        permissions: [...classItem.permissions],
      });
      const hasSessionEnded = new Date(timestampAtTime(date, `${endTime}:00`)) < referenceDate;
      if (date < today || (date === today && classItem.id === 'lop-junior-3' && hasSessionEnded)) {
        attendanceBySession[sessionId] = {
          records: studentsByClass[classItem.id].map((student, index) => ({
            studentId: student.id,
            status:
              index !== 0 && index % 13 === 0 ? 'absent' : index % 7 === 0 ? 'late' : 'present',
            note: index % 7 === 0 ? 'Đến trễ 5 phút' : '',
          })),
          savedAt: timestampAtTime(date, `${endTime}:00`),
        };
      }
    }
  }
  sessions.sort((left, right) =>
    `${left.iso} ${left.startTime}`.localeCompare(`${right.iso} ${right.startTime}`)
  );

  const draftsByGrant = Object.fromEntries(
    gradingGrants.map((grant) => [
      grant.id,
      {
        rows: createGradeRows(studentsByClass[grant.classId], grant.id === 'quyen-junior-cu'),
        version: '1',
        updatedAt: relativeTimestamp(-3),
      },
    ])
  );
  const requests = [
    {
      id: 'yeucau-junior-da-duyet',
      classId: 'lop-junior-3',
      className: 'Giao tiếp Junior 3',
      assessmentId: 'bai-lop-junior-3-giuaky',
      title: 'Kiểm tra giữa kỳ',
      from: periodOpensAt,
      to: periodClosesAt,
      note: 'Em hỗ trợ nhập điểm bốn kỹ năng cho lớp.',
      status: 'APPROVED',
      createdAt: relativeTimestamp(-2880),
      reviewedAt: relativeTimestamp(-2820),
      reviewNote: 'Đã mở quyền nhập điểm. Em kiểm tra đủ bốn kỹ năng nhé.',
      teacher: 'Cô Phạm Thu Hà',
    },
    {
      id: 'yeucau-toeic-cho-duyet',
      classId: 'lop-toeic-650',
      className: 'TOEIC 650+',
      assessmentId: 'bai-lop-toeic-650-giuaky',
      title: 'Kiểm tra giữa kỳ',
      from: timestampAtTime(addDays(today, 1), '08:00:00'),
      to: timestampAtTime(addDays(today, 2), '18:00:00'),
      note: 'Em hỗ trợ tổng hợp điểm bài kiểm tra giữa kỳ.',
      status: 'PENDING',
      createdAt: relativeTimestamp(-120),
      reviewedAt: '',
      reviewNote: '',
      teacher: 'Thầy Lê Anh Dũng',
    },
    {
      id: 'yeucau-starters-tu-choi',
      classId: 'lop-starters-a',
      className: 'Starters Kids A',
      assessmentId: 'bai-starters-cu',
      title: 'Kiểm tra tuần trước',
      from: timestampAtTime(addDays(today, -3), '08:00:00'),
      to: timestampAtTime(addDays(today, -2), '18:00:00'),
      note: 'Em xin hỗ trợ nhập điểm cho lớp.',
      status: 'REJECTED',
      createdAt: relativeTimestamp(-5760),
      reviewedAt: relativeTimestamp(-5700),
      reviewNote: 'Bảng điểm này cô đã hoàn thành. Em hỗ trợ kỳ tiếp theo nhé.',
      teacher: 'Cô Phạm Thu Hà',
    },
  ];
  const gradeSubmissions = [
    {
      id: 'bangdiem-junior-tra-lai',
      classId: 'lop-junior-3',
      className: 'Giao tiếp Junior 3',
      assessmentId: 'bai-lop-junior-3-giuaky',
      title: 'Kiểm tra giữa kỳ',
      status: 'RETURNED',
      createdAt: relativeTimestamp(-1440),
      reviewedAt: relativeTimestamp(-1380),
      reviewNote: 'Em kiểm tra lại điểm phần Viết và hoàn thiện các học viên còn thiếu.',
      studentCount: 15,
      grantId: 'quyen-junior-mo',
    },
    {
      id: 'bangdiem-junior-da-duyet',
      classId: 'lop-junior-3',
      className: 'Giao tiếp Junior 3',
      assessmentId: 'bai-junior-thang-truoc',
      title: 'Kiểm tra tháng trước',
      status: 'APPROVED',
      createdAt: relativeTimestamp(-11520),
      reviewedAt: relativeTimestamp(-11400),
      reviewNote: 'Đã kiểm tra và phê duyệt bảng điểm.',
      studentCount: 15,
      grantId: 'quyen-junior-cu',
    },
  ];

  return {
    phienBan: 1,
    ngayKhoiTao: today,
    staffId: 'tg-thaovy',
    classes: classList,
    periods: assessments,
    grants: gradingGrants,
    requests,
    submissions: gradeSubmissions,
    hocVienTheoLop: studentsByClass,
    buoiHoc: sessions,
    diemDanhTheoBuoi: attendanceBySession,
    banNhapTheoQuyen: draftsByGrant,
    thongBao: [
      {
        id: 'thongbao-mo-quyen',
        title: 'Giảng viên đã mở quyền nhập điểm',
        text: 'Cô Phạm Thu Hà đã mở quyền nhập điểm lớp Giao tiếp Junior 3 cho Thảo Vy.',
        read: false,
        time: relativeTimestamp(-30),
        announcementId: null,
        type: 'GRADING',
      },
      {
        id: 'thongbao-chinh-sua',
        title: 'Bảng điểm cần chỉnh sửa',
        text: 'Kiểm tra phản hồi của giảng viên trước khi gửi lại bảng điểm giữa kỳ.',
        read: false,
        time: relativeTimestamp(-1380),
        announcementId: null,
        type: 'GRADING',
      },
      {
        id: 'thongbao-lich',
        title: 'Lịch hỗ trợ trong tuần',
        text: 'Lịch hỗ trợ của bạn đã được cập nhật. Vui lòng kiểm tra phòng học trước mỗi buổi.',
        read: true,
        time: relativeTimestamp(-2880),
        announcementId: null,
        type: 'SCHEDULE',
      },
    ],
  };
}
