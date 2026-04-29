export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold text-[var(--theme-text-primary)]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--theme-text-body)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
