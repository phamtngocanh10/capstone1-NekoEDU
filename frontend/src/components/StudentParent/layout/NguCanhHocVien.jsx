import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createDemoData } from '../data/duLieuMau';
import { readDemoData, DEMO_DATA_KEY, writeDemoData, cloneData } from '../data/luuTruMau';
import * as studentActions from '../data/xuLyDuLieu';

const StudentParentContext = createContext(null);

export function StudentParentProvider({ children }) {
  const [data, setData] = useState(readDemoData);
  const currentDataRef = useRef(data);
  const [toastMessage, setToastMessage] = useState('');
  const notify = useCallback((message) => setToastMessage(String(message)), []);
  const clearToast = useCallback(() => setToastMessage(''), []);

  useEffect(() => {
    function handleStorageChange(event) {
      if (event.key !== DEMO_DATA_KEY) return;
      const nextData = readDemoData();
      currentDataRef.current = nextData;
      setData(nextData);
    }
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateData = useCallback((updateDraft) => {
    // Hai thao tác liên tiếp luôn dùng bản vừa lưu, kể cả khi React chưa render lại.
    const draft = cloneData(currentDataRef.current);
    const result = updateDraft(draft);
    writeDemoData(draft);
    currentDataRef.current = draft;
    setData(draft);
    return result;
  }, []);

  const student = studentActions.getSelectedStudent(data);
  const enrolledCourses = studentActions.getEnrolledCourses(data, student.ma);
  const invoices = studentActions.getInvoices(data, student.ma);
  const notifications = studentActions.getNotifications(data, student.ma);

  function selectStudent(id) {
    return updateData((draft) => studentActions.selectStudent(draft, id));
  }

  function registerCourse(payload) {
    return updateData((draft) => studentActions.registerCourse(draft, payload));
  }

  function payInvoice(invoiceId, paymentMethod) {
    return updateData((draft) => studentActions.payInvoice(draft, invoiceId, paymentMethod));
  }

  function markNotificationRead(notificationId, isRead = true) {
    return updateData((draft) =>
      studentActions.markNotificationRead(draft, notificationId, isRead)
    );
  }

  function markAllNotificationsRead() {
    return updateData((draft) => studentActions.markAllNotificationsRead(draft));
  }

  function sendNotificationFeedback(payload) {
    return updateData((draft) => studentActions.sendNotificationFeedback(draft, payload));
  }

  function submitCourseReview(payload) {
    return updateData((draft) => studentActions.submitCourseReview(draft, payload));
  }

  function saveProfile(payload) {
    return updateData((draft) => studentActions.saveProfile(draft, payload));
  }

  function resetDemoData() {
    const nextData = createDemoData();
    writeDemoData(nextData);
    currentDataRef.current = nextData;
    setData(nextData);
  }

  const context = {
    data,
    student,
    enrolledCourses,
    invoices,
    notifications,
    selectStudent,
    notify,
    toastMessage,
    clearToast,
    registerCourse,
    payInvoice,
    markNotificationRead,
    markAllNotificationsRead,
    sendNotificationFeedback,
    submitCourseReview,
    saveProfile,
    resetDemoData,
  };
  return <StudentParentContext.Provider value={context}>{children}</StudentParentContext.Provider>;
}

export function useStudentParent() {
  const context = useContext(StudentParentContext);
  if (!context) throw new Error('useStudentParent must be used within StudentParentProvider.');
  return context;
}
