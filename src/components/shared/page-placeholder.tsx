interface PagePlaceholderProps {
  title: string;
  description: string;
}

/** Temporary page body for routes whose feature lands in a later task. */
export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
