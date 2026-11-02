import { useSyncExternalStore } from 'react'

// Kho trạng thái dùng chung rất nhỏ (thay cho Context/Redux khi chỉ cần chia sẻ dữ liệu mẫu giữa vài trang).
// Khi có backend: bỏ store, gọi API trong src/api/* và refetch.
export default function createStore(initial) {
  let state = initial
  const listeners = new Set()
  const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb) }
  return {
    get: () => state,
    set: (next) => {
      state = typeof next === 'function' ? next(state) : next
      listeners.forEach((l) => l())
    },
    use: () => useSyncExternalStore(subscribe, () => state),
  }
}
