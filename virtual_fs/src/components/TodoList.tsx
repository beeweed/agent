import { useState } from 'react'
import { Todo } from '../types'

interface TodoListProps {
  todos: Todo[]
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
  editTodo: (id: string, newText: string) => void
}

function TodoList({ todos, toggleTodo, deleteTodo, editTodo }: TodoListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  const saveEdit = (id: string) => {
    if (editText.trim() !== '') {
      editTodo(id, editText.trim())
      setEditingId(null)
      setEditText('')
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="space-y-3">
      {todos.map(todo => (
        <div
          key={todo.id}
          className={`group flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${
            todo.completed
              ? 'bg-gray-50 border-gray-200'
              : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-md'
          }`}
        >
          <button
            onClick={() => toggleTodo(todo.id)}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              todo.completed
                ? 'bg-gradient-to-r from-green-400 to-green-600 border-green-500'
                : 'border-gray-300 hover:border-purple-400'
            }`}
          >
            {todo.completed && (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {editingId === todo.id ? (
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(todo.id)
                  if (e.key === 'Escape') cancelEdit()
                }}
                className="flex-1 px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <button
                onClick={() => saveEdit(todo.id)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex-1">
              <p
                className={`text-lg ${
                  todo.completed ? 'text-gray-500 line-through' : 'text-gray-800'
                }`}
              >
                {todo.text}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {todo.createdAt.toLocaleDateString()}
              </p>
            </div>
          )}

          <div className={`flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${editingId === todo.id ? 'opacity-100' : ''}`}>
            {editingId !== todo.id && (
              <>
                <button
                  onClick={() => startEditing(todo)}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default TodoList