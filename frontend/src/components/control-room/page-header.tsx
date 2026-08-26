export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
