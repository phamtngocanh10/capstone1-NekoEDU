import { useSyncExternalStore } from 'react'

// Kho trạng thái dùng chung rất nhỏ (thay cho Context/Redux khi chỉ cần chia sẻ dữ liệu mẫu giữa vài trang).
// Khi có backend: bỏ store, gọi API trong src/api/* và refetch.
export default function createStore(initial) {
  let state = initial
  const listeners = new Set()
  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function setState(nextState) {
    // Cho phép truyền giá trị mới hoặc hàm tính từ trạng thái hiện tại.
    if (typeof nextState === 'function') state = nextState(state)
    else state = nextState
    listeners.forEach((listener) => listener())
  }

  return {
    get: () => state,
    set: setState,
    use: () => useSyncExternalStore(subscribe, () => state),
  }
}
