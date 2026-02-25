import { useState } from 'react'

interface TodoInputProps {
  addTodo: (text: string) => void
}

function TodoInput({ addTodo }: TodoInputProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() !== '') {
      addTodo(input.trim())
      setInput('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="What needs to be done?"
          className="flex-1 px-6 py-4 text-lg border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          style={{
            borderColor: isFocused ? 'transparent' : '#e5e7eb',
            boxShadow: isFocused ? '0 0 0 3px rgba(147, 51, 234, 0.1)' : 'none'
          }}
        />
        <button
          type="submit"
          className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </form>
  )
}

export default TodoInput