import { useEffect } from 'react'
import { CircleCheck } from 'lucide-react'

export default function Toast({ message, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000)
    return () => clearTimeout(timer)
  }, [message, onDone])

  return (
    <div className="toast" role="status">
      <CircleCheck size={16} /> {message}
    </div>
  )
}
