import type { ReactNode } from "react";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
