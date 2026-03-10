import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/boxes')({
  component: BoxesLayout,
})

function BoxesLayout() {
  return <Outlet />
}
