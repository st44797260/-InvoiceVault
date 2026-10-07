export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 border-dashed px-6 py-16 text-center">
      {Icon && (
        <span className="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
          <Icon className="h-10 w-10 text-primary/60" />
        </span>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
