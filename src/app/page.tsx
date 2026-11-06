export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <main className="flex flex-col items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Trading Journal</h1>
        <p className="max-w-md text-balance text-muted-foreground">
          Real-time MT5 trade sync, strategy tagging, and professional analytics.
        </p>
      </main>
      <footer className="text-xs text-muted-foreground">
        Under construction — phases tracked in <code className="font-mono">tasks/</code>
        .
      </footer>
    </div>
  );
}
