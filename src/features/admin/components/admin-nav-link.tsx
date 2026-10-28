import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@/components/ui/button'
import { useAdminSession } from '../hooks/use-admin-session'

/** A header link to the admin panel, shown only to a signed-in admin. */
export function AdminNavLink() {
  const { isAdmin } = useAdminSession()
  if (!isAdmin) return null
  return (
    <Link
      to="/admin-manage"
      className={buttonVariants({ variant: 'ghost' })}
      activeProps={{ 'aria-current': 'page', className: 'bg-muted' }}
    >
      Admin
    </Link>
  )
}
