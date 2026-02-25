import { useState, useEffect } from 'react'
import { Todo } from './types'
import TodoList from './components/TodoList'
import TodoInput from './components/TodoInput'

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('todos')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  const addTodo = (text: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false,
      createdAt: new Date()
    }
    setTodos([...todos, newTodo])
  }

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  const editTodo = (id: string, newText: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, text: newText } : todo
    ))
  }

  const completedCount = todos.filter(t => t.completed).length
  const totalCount = todos.length

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
            ✨ Todo List
          </h1>
          <p className="text-white/80 text-lg">
            Stay organized and get things done
          </p>
        </header>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <TodoInput addTodo={addTodo} />

          <div className="mt-8">
            <div className="flex items-center justify-between mb-6 text-sm">
              <span className="text-gray-600">
                {totalCount} {totalCount === 1 ? 'item' : 'items'}
              </span>
              {totalCount > 0 && (
                <span className="text-green-600 font-medium">
                  ✓ {completedCount} completed
                </span>
              )}
            </div>

            <TodoList
              todos={todos}
              toggleTodo={toggleTodo}
              deleteTodo={deleteTodo}
              editTodo={editTodo}
            />

            {todos.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-gray-500">No todos yet. Add one above!</p>
              </div>
            )}
          </div>
        </div>

        <footer className="text-center mt-8 text-white/60 text-sm">
          <p>Crafted with ❤️ and React + Tailwind</p>
        </footer>
      </div>
    </div>
  )
}

export default App