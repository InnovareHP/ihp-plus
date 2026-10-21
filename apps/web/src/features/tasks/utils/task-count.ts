/** "1 task", "3 tasks": read aloud as a column's name, so the grammar matters. */
export function taskCount(count: number) {
  return `${count} ${count === 1 ? 'task' : 'tasks'}`
}
