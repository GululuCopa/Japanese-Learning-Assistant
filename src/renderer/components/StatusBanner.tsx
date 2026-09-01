export function StatusBanner({
  children,
  tone = 'info',
}: {
  children: string
  tone?: 'info' | 'error'
}) {
  return (
    <div className={`banner ${tone === 'error' ? 'error' : ''}`} role="status">
      {children}
    </div>
  )
}
