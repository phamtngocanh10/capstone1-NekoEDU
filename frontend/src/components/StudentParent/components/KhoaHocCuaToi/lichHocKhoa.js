export const formatCourseWeekdays = (courseDetails) =>
  courseDetails.thuHoc.map((weekday) => (weekday === 0 ? 'CN' : `T${weekday + 1}`)).join(' · ');
