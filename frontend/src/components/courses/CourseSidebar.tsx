import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCourses } from '@/hooks/useCourses'
import { CourseModal } from './CourseModal'
import type { Course } from '@/types/database'

export function CourseSidebar() {
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
          <p className="text-xs text-muted-foreground px-1">No courses yet.</p>
        )}

        {courses.map((course) => (
          <button
            key={course.id}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm text-left transition-colors"
            onClick={() => openEdit(course)}
          >
            <span
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: course.color }}
            />
            <span className="truncate">{course.name}</span>
          </button>
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
