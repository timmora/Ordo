import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCourses } from '@/hooks/useCourses'

interface CourseDropdownProps {
  courseId: string
  onChange: (courseId: string) => void
  onAddCourse: () => void
}

export function CourseDropdown({ courseId, onChange, onAddCourse }: CourseDropdownProps) {
  const { data: courses = [] } = useCourses()

  const selectedName = courseId === 'none'
    ? 'No course'
    : courses.find((c) => c.id === courseId)?.name ?? 'No course'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          {selectedName}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuGroup>
          {courseId !== 'none' && (
            <DropdownMenuItem onSelect={() => onChange('none')}>No course</DropdownMenuItem>
          )}
          {courses.filter((c) => c.id !== courseId).map((c) => (
            <DropdownMenuItem key={c.id} onSelect={() => onChange(c.id)}>
              {c.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onAddCourse}>+ Add course</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
