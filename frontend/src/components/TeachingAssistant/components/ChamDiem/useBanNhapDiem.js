import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assistantData } from '../../data/duLieuTroGiang';
import { ERROR_CODES } from '../../data/luuTruMau';
import { useAsyncData } from '../shared/DungChung';
import { hasCompleteScores, isValidScore, createGradePayload } from './xuLyDiem';
import useUnsavedChanges from '../shared/useBaoVeThayDoi';

const AUTOSAVE_DELAY_MS = 1000;
const GRANT_CHECK_INTERVAL_MS = 15000;

export default function useGradeDraft(grantId) {
  const {
    data: draft,
    error: loadError,
    reload,
  } = useAsyncData(() => assistantData.getGradeDraft(grantId), [grantId]);
  const [rows, setRows] = useState([]);
  const [savedContent, setSavedContent] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [submitting, setSubmitting] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const currentRowsRef = useRef([]);
  const versionRef = useRef(null);
  const savedContentRef = useRef('');
  const saveQueueRef = useRef(Promise.resolve());
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  const reloadingRef = useRef(false);
  const conflictRef = useRef(false);
  const allowNavigationRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setInterval(() => setCurrentTime(Date.now()), GRANT_CHECK_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!draft) return;
    const initialRows = draft.rows.map((row) => ({
      ...row,
      scores: row.scores.map((value) => value ?? ''),
      note: row.note || '',
    }));
    const initialContent = JSON.stringify(createGradePayload(initialRows));
    currentRowsRef.current = initialRows;
    versionRef.current = draft.version;
    savedContentRef.current = initialContent;
    conflictRef.current = false;
    setRows(initialRows);
    setSavedContent(initialContent);
    setSavedAt(draft.updatedAt);
    setError('');
    setSaveStatus('idle');
    setConflict(false);
  }, [draft]);

  const currentContent = useMemo(() => JSON.stringify(createGradePayload(rows)), [rows]);
  const hasChanges = Boolean(savedContent) && currentContent !== savedContent;
  const hasInvalidScores = rows.some((row) => row.scores.some((value) => !isValidScore(value)));
  const expiresAt = draft?.closesAt ? new Date(draft.closesAt).getTime() : Infinity;
  const canEnterGrades = Boolean(draft?.editable) && currentTime <= expiresAt;

  const saveInSequence = useCallback(
    (rowsToSave) => {
      const gradePayload = createGradePayload(rowsToSave);
      const contentToSave = JSON.stringify(gradePayload);

      // Mỗi yêu cầu dùng phiên bản từ lần lưu trước, kể cả khi người dùng nhập nhanh.
      const saveOperation = saveQueueRef.current
        .catch(() => {})
        .then(async () => {
          if (!mountedRef.current) return false;
          if (conflictRef.current)
            throw new Error('Bản nháp đã thay đổi. Hãy tải lại trước khi tiếp tục.');
          if (contentToSave === savedContentRef.current) return true;
          setSaveStatus('saving');

          try {
            const result = await assistantData.saveGradeDraft(grantId, {
              rows: gradePayload,
              version: versionRef.current,
            });
            versionRef.current = result.version;
            savedContentRef.current = contentToSave;
            if (mountedRef.current) {
              setSavedContent(contentToSave);
              setSavedAt(result.updatedAt);
              setSaveStatus('saved');
              setError('');
            }
            return true;
          } catch (saveError) {
            if ([ERROR_CODES.VERSION_CONFLICT, ERROR_CODES.GRANT_CLOSED].includes(saveError.code)) {
              conflictRef.current = true;
              if (mountedRef.current) setConflict(true);
            }
            if (mountedRef.current) {
              setSaveStatus('error');
              setError(
                saveError.message ||
                  'Chưa lưu được bản nháp. Các điểm bạn nhập vẫn được giữ trên màn hình.'
              );
            }
            throw saveError;
          }
        });

      saveQueueRef.current = saveOperation;
      return saveOperation;
    },
    [grantId]
  );

  useEffect(() => {
    if (
      !hasChanges ||
      !canEnterGrades ||
      hasInvalidScores ||
      submitting ||
      reloading ||
      saveStatus === 'error'
    )
      return;
    const timer = setTimeout(() => {
      saveInSequence(currentRowsRef.current).catch(() => {});
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    currentContent,
    hasChanges,
    canEnterGrades,
    hasInvalidScores,
    submitting,
    reloading,
    saveStatus,
    saveInSequence,
  ]);

  useUnsavedChanges(hasChanges, {
    allowNavigationRef,
    message: 'Điểm chưa được lưu nháp. Rời trang và bỏ các điểm chưa lưu?',
  });

  function changeScore(studentId, skillIndex, value) {
    if (!canEnterGrades || submittingRef.current || reloadingRef.current || conflictRef.current)
      return;
    const nextRows = currentRowsRef.current.map((row) =>
      row.studentId === studentId
        ? {
            ...row,
            scores: row.scores.map((score, index) => (index === skillIndex ? value : score)),
          }
        : row
    );
    currentRowsRef.current = nextRows;
    setRows(nextRows);
  }

  async function saveDraft() {
    if (!canEnterGrades || submittingRef.current || reloadingRef.current) return false;
    if (hasInvalidScores) {
      setError('Điểm phải từ 0 đến 9, theo bước 0,5.');
      return false;
    }
    return saveInSequence(currentRowsRef.current);
  }

  async function submitGradeSheet() {
    if (!canEnterGrades || submittingRef.current || reloadingRef.current) return false;
    const rowsToSubmit = currentRowsRef.current;
    if (!rowsToSubmit.length || !rowsToSubmit.every(hasCompleteScores)) {
      setError('Cần nhập đủ bốn kỹ năng của tất cả học viên trước khi gửi duyệt.');
      return false;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      if (!(await saveInSequence(rowsToSubmit))) return false;
      await assistantData.submitGrades(grantId, {
        rows: createGradePayload(rowsToSubmit),
        version: versionRef.current,
      });
      allowNavigationRef.current = true;
      return true;
    } catch (submitError) {
      if (mountedRef.current)
        setError(submitError.message || 'Chưa gửi được bảng điểm. Vui lòng thử lại.');
      throw submitError;
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  async function reloadDraft() {
    if (submittingRef.current || reloadingRef.current) return;
    reloadingRef.current = true;
    setReloading(true);
    try {
      // Đợi lần lưu đang chạy kết thúc để phản hồi cũ không ghi đè phiên bản vừa tải.
      await saveQueueRef.current.catch(() => {});
      if (mountedRef.current) reload();
    } finally {
      reloadingRef.current = false;
      if (mountedRef.current) setReloading(false);
    }
  }

  return {
    draft,
    rows,
    hasChanges,
    hasInvalidScores,
    canEnterGrades,
    conflict,
    saveStatus,
    savedAt,
    error,
    loadError,
    submitting,
    reloading,
    changeScore,
    saveGradeDraft: saveDraft,
    submitGradeSheet,
    reloadDraft,
  };
}
