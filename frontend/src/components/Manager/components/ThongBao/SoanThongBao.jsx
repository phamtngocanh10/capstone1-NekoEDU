import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, CircleCheck, Clock, Eye, Paperclip, Send, X } from 'lucide-react'
import { Btn, Card, CheckRow, Chip, Dialog, Segmented, Switch } from '../../../../common/ui'
import { todayText } from '../../../../common/format'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { TYPES } from './data'
import { createAnnouncement, updateAnnouncement, getAnnouncementOptions } from '../../../../api/announcements'
import { encodeFiles, operationError, sqlDate } from '../../../../api/finance'

function formatFileSize(bytes) {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Figma 16.1 — Soạn thông báo mới (6 mục + xem trước phía học viên)
export default function SoanThongBao() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { notify } = useManager()
  const fileRef = useRef(null)
  const draftId = useRef(null)
  const draftSave = useRef(Promise.resolve())
  const manualSave = useRef(false)
  usePageHeader('Soạn thông báo mới', 'Hoàn thành lần lượt các mục 1 → 6 rồi gửi cho học viên')
  const template = state?.template
  const [title, setTitle] = useState(template?.title ?? '')
  const [type, setType] = useState(TYPES[Math.max(0, ['SCHEDULE', 'TUITION', 'ASSESSMENT', 'EVENT', 'SYSTEM'].indexOf(template?.messageType))])
  const [important, setImportant] = useState(false)
  const [content, setContent] = useState(template?.content ?? '')
  const [files, setFiles] = useState([])
  const [target, setTarget] = useState(state?.studentCode ? 'student' : 'class')
  const [classes, setClasses] = useState(() => new Set())
  const [CLASS_TARGETS, setClassTargets] = useState([])
  const [studentCount, setStudentCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [names, setNames] = useState(state?.studentCode ?? '')
  const [when, setWhen] = useState('later')
  const [date, setDate] = useState(todayText())
  const [time, setTime] = useState('08:30')
  const [pin, setPin] = useState(false)
  const [mail, setMail] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  useEffect(() => {
    getAnnouncementOptions().then((data) => { setClassTargets(data.classes); setStudentCount(data.studentCount) })
      .catch((error) => notify(operationError(error)))
  }, [])

  let recipients = studentCount
  let audience = 'Tất cả học viên'
  if (target === 'student') {
    recipients = names.split(',').map((name) => name.trim()).filter(Boolean).length
    audience = 'Học viên được chọn'
  } else if (target !== 'all') {
    recipients = CLASS_TARGETS
      .filter((classItem) => classes.has(classItem.name))
      .reduce((total, classItem) => total + classItem.n, 0)
    audience = `Lớp ${[...classes].join(', ')}`
  }

  async function buildPayload(status, includeFiles = true) {
    return { title: title.trim() || 'Bản nháp chưa đặt tên', content,
        message_type: ['SCHEDULE', 'TUITION', 'ASSESSMENT', 'EVENT', 'SYSTEM'][TYPES.indexOf(type)],
        priority: important ? 'IMPORTANT' : 'NORMAL', audience_type: { all: 'ALL_STUDENTS', class: 'CLASSES', student: 'STUDENTS' }[target],
        status, class_ids: CLASS_TARGETS.filter((c) => classes.has(c.name)).map((c) => c.id),
        students: names.split(',').map((name) => name.trim()).filter(Boolean),
        scheduled_at: status === 'SCHEDULED' ? `${sqlDate(date)}T${time}:00+07:00` : null,
        is_pinned: pin, send_email: mail, send_push: mail,
        files: includeFiles ? await encodeFiles(files.map((file) => file.original)) : [], template_id: template?.id && /^\d+$/.test(template.id) ? Number(template.id) : null }
  }
  async function savePayload(payload) {
    const data = draftId.current ? await updateAnnouncement(draftId.current, payload) : await createAnnouncement(payload)
    draftId.current = data.item.id
    setSavedAt(new Date().toTimeString().slice(0, 5))
    return data
  }
  useEffect(() => {
    if (saving || (!title.trim() && !content.trim())) return
    const timer = setTimeout(() => {
      if (manualSave.current) return
      draftSave.current = draftSave.current.catch(() => {}).then(async () => {
        if (manualSave.current) return
        await savePayload(await buildPayload('DRAFT', false))
      }).catch((error) => notify(operationError(error)))
    }, 2000)
    return () => clearTimeout(timer)
  }, [title, content, type, important, target, classes, names, pin, mail, CLASS_TARGETS, saving])
  async function persist(status) {
    if (manualSave.current) return
    manualSave.current = true
    setSaving(true)
    try {
      await draftSave.current
      const data = await savePayload(await buildPayload(status))
      notify(status === 'DRAFT' ? 'Đã lưu bản nháp' : status === 'SCHEDULED' ? 'Đã lưu lịch gửi thông báo' :
        data.item.status === 'sending' ? 'Đã gửi trong ứng dụng; email và thông báo đẩy đang chờ xử lý' : 'Đã gửi thông báo trong ứng dụng')
      navigate('/thongbao')
    } catch (error) { notify(operationError(error)) }
    finally { setSaving(false); manualSave.current = false }
  }
  function send() {
    if (!title.trim() || !content.trim()) return notify('Vui lòng nhập tiêu đề và nội dung thông báo')
    if (recipients === 0) return notify('Vui lòng chọn người nhận')
    persist(when === 'later' ? 'SCHEDULED' : 'SENT')
  }
  function saveDraft() {
    persist('DRAFT')
  }
  function addFiles(event) {
    const selected = Array.from(event.target.files)
    if (files.length + selected.length > 5 || selected.some((file) => file.size < 1 || file.size > 20 * 1048576)) {
      event.target.value = ''
      return notify('Chọn tối đa 5 tệp, mỗi tệp từ 1 byte đến 20 MB')
    }
    const addedFiles = Array.from(event.target.files).map((file) => ({
      name: file.name,
      kind: file.name.split('.').pop().toUpperCase(),
      size: formatFileSize(file.size),
      original: file,
    }))
    setFiles((currentFiles) => [...currentFiles, ...addedFiles])
    event.target.value = ''
  }

  function removeFile(index) {
    setFiles((currentFiles) => currentFiles.filter((file, fileIndex) => fileIndex !== index))
  }

  function selectClass(className, selected) {
    setClasses((currentClasses) => {
      const nextClasses = new Set(currentClasses)
      if (selected) nextClasses.add(className)
      else nextClasses.delete(className)
      return nextClasses
    })
  }

  return (
    <div className="u-page">
      <div className="cp-cols">
        <div className="cp-col">
          <Card className="cp-sec">
            <h4><b>1</b>Tiêu đề thông báo <span className="u-bad">*</span><em>{title.length} / 120</em></h4>
            <div className="u-control"><input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Lịch thi giữa kỳ KID 2A" aria-label="Tiêu đề thông báo" /></div>
          </Card>

          <Card className="cp-sec">
            <h4><b>2</b>Loại &amp; mức ưu tiên</h4>
            <div className="u-row">
              <div className="u-control" style={{ flex: 1 }}>
                <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại thông báo">{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
              <div style={{ flex: 1 }}><Segmented value={important ? 'high' : 'normal'} onChange={(v) => setImportant(v === 'high')} items={[{ value: 'normal', label: 'Thường' }, { value: 'high', label: 'Quan trọng', danger: true }]} /></div>
            </div>
          </Card>

          <Card className="cp-sec">
            <h4><b>3</b>Nội dung thông báo <span className="u-bad">*</span></h4>
            <div className="cp-editor">
              <div className="cp-editor__bar">
                <button type="button" className="u-eye" aria-label="Đính kèm tệp" onClick={() => fileRef.current?.click()}><Paperclip size={15} /></button>
                <span style={{ marginLeft: 'auto' }}>Hiển thị cho học viên &amp; phụ huynh</span>
              </div>
              <textarea value={content} maxLength={2000} onChange={(e) => setContent(e.target.value)} placeholder="Nhập nội dung thông báo..." aria-label="Nội dung thông báo" />
            </div>
            <p className="u-faint" style={{ marginTop: 6, textAlign: 'right', fontSize: 10.8 }}>{content.length} / 2000 ký tự</p>
          </Card>

          <Card className="cp-sec">
            <h4><b>4</b>Tệp đính kèm<em>Tối đa 5 tệp · ≤ 20 MB/tệp</em></h4>
            <label className="u-drop">
              <Paperclip size={20} />
              Kéo thả tệp vào đây hoặc chọn từ máy tính
              <small>PDF, DOCX, XLSX, PNG, JPG</small>
              <input ref={fileRef} type="file" hidden multiple onChange={addFiles} />
            </label>
            <div className="cp-files">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="cp-file">
                  <span className="exp-file__icon"><Paperclip size={14} /></span>
                  <div className="u-grow"><strong>{f.name}</strong><small>{f.kind} · {f.size}</small></div>
                  <span className="u-good u-strong" style={{ fontSize: 11 }}>✓ Đã chọn</span>
                  <button type="button" aria-label={`Xóa ${f.name}`} onClick={() => removeFile(i)}><X size={14} /></button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="cp-col">
          <Card className="cp-sec">
            <h4><b>5</b>Người nhận <span className="u-bad">*</span></h4>
            <Segmented value={target} onChange={setTarget} items={[{ value: 'all', label: 'Tất cả' }, { value: 'class', label: 'Theo lớp' }, { value: 'student', label: 'Theo học viên' }]} />
            {target === 'class' && (
              <div className="cp-classes">
                <span className="u-field__label">Chọn lớp nhận thông báo</span>
                {CLASS_TARGETS.map((c) => (
                  <CheckRow key={c.name} checked={classes.has(c.name)} onChange={(selected) => selectClass(c.name, selected)}>
                    <span className="u-grow">{c.name}</span><small>{c.n} học viên</small>
                  </CheckRow>
                ))}
              </div>
            )}
            {target === 'student' && (
              <div className="u-control u-control--area" style={{ margin: '12px 0' }}>
                <textarea value={names} onChange={(e) => setNames(e.target.value)} placeholder="Nhập tên hoặc mã học viên, cách nhau bằng dấu phẩy" aria-label="Danh sách học viên" />
              </div>
            )}
            {target === 'all' && <div style={{ height: 12 }} />}
            <div className="cp-sum">Đã chọn {recipients} học viên · gửi tới tài khoản được liên kết</div>
          </Card>

          <Card className="cp-sec">
            <h4><b>6</b>Tùy chọn gửi</h4>
            <Segmented value={when} onChange={setWhen} items={[{ value: 'now', label: 'Gửi ngay' }, { value: 'later', label: 'Hẹn giờ gửi' }]} />
            {when === 'later' && (
              <div className="cp-two">
                <div className="u-control u-control--sm"><input value={date} onChange={(e) => setDate(e.target.value)} aria-label="Ngày gửi" /></div>
                <div className="u-control u-control--sm"><input value={time} onChange={(e) => setTime(e.target.value)} aria-label="Giờ gửi" /></div>
              </div>
            )}
            <div className="u-row u-row--between" style={{ marginTop: 14 }}><span>Ghim lên đầu danh sách</span><Switch checked={pin} onChange={setPin} label="Ghim lên đầu danh sách" /></div>
            <div className="u-row u-row--between" style={{ marginTop: 10 }}><span>Gửi kèm email &amp; thông báo đẩy</span><Switch checked={mail} onChange={setMail} label="Gửi kèm email và thông báo đẩy" /></div>
          </Card>

          <Card className="cp-sec">
            <h4>Xem trước phía học viên</h4>
            <div className="cp-prev">
              <div className="u-row" style={{ alignItems: 'flex-start' }}>
                <span className="u-iconcircle"><Bell size={14} /></span>
                <div className="u-grow">
                  <strong>{title || 'Tiêu đề thông báo'}</strong>
                  <p>{content.slice(0, 90) || 'Nội dung thông báo sẽ hiển thị ở đây...'}</p>
                  <div className="u-row u-row--between"><span className="u-faint" style={{ fontSize: 11 }}><Paperclip size={11} /> {files.length} tệp</span>{important && <Chip tone="red">Quan trọng</Chip>}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="ds-foot">
        <span><Clock size={12} style={{ verticalAlign: -2 }} /> {saving ? 'Đang lưu bản nháp...' : savedAt ? `Bản nháp tự động lưu lúc ${savedAt}` : 'Bản nháp chưa lưu'}</span>
        <div className="u-row">
          <Btn variant="ghost" size="md" onClick={() => navigate('/thongbao')}>Hủy</Btn>
          <Btn variant="ghost" size="md" disabled={saving} onClick={saveDraft}>Lưu nháp</Btn>
          <Btn variant="ghost" size="md" icon={Eye} onClick={() => setShowPreview(true)}>Xem trước</Btn>
          <Btn size="md" disabled={saving} icon={when === 'later' ? Clock : Send} onClick={send}>{when === 'later' ? 'Lên lịch gửi' : 'Gửi ngay'}</Btn>
        </div>
      </div>

      {showPreview && (
        <Dialog title={title || 'Tiêu đề thông báo'} subtitle={`${type}${important ? ' · Quan trọng' : ''} · gửi tới ${recipients} học viên`} onClose={() => setShowPreview(false)}>
          <div className="hp-msg">{content || 'Chưa có nội dung.'}</div>
          <div className="u-modal__foot"><Btn variant="ghost" size="sq" icon={CircleCheck} onClick={() => setShowPreview(false)}>Đóng</Btn></div>
        </Dialog>
      )}
    </div>
  )
}
