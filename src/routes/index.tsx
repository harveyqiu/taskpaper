import { createFileRoute } from '@tanstack/react-router'
import { TaskPaperApp } from '../components/TaskPaperApp'

export const Route = createFileRoute('/')({
  component: TaskPaperApp,
})
