import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCourses } from '@/hooks/useCourses'
import { CourseModal } from './CourseModal'
import type { Course } from '@/types/database'

interface Props {
  onCourseClick?: (courseId: string) => void
}

export function CourseSidebar({ onCourseClick }: Props) {
  const { data: courses = [] } = useCourses()
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Course | undefined>()

  function openEdit(course: Course) {
    setSelected(course)
    setModalOpen(true)
  }

  function openCreate() {
    setSelected(undefined)
    setModalOpen(true)
  }

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Courses
          </span>
          <Button size="icon" variant="ghost" className="size-6" onClick={openCreate}>
            <Plus className="size-3.5" />
          </Button>
        </div>

        {courses.length === 0 && (
          <button
            type="button"
            onClick={openCreate}
            className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-1 underline-offset-2 hover:underline transition-colors"
          >
            + Add your first course
          </button>
        )}

        {courses.map((course) => (
          <div
            key={course.id}
            className="group w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm text-left transition-colors"
          >
            <button
              type="button"
              className="flex-1 min-w-0 flex items-center gap-2"
              onClick={() => onCourseClick?.(course.id)}
            >
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: course.color }}
              />
              <span className="truncate">{course.name}</span>
            </button>
            <button
              type="button"
              className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
              onClick={() => openEdit(course)}
            >
              <Pencil className="size-3" />
            </button>
          </div>
        ))}
      </div>

      <CourseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        course={selected}
      />
    </>
  )
}
