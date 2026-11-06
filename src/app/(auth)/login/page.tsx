import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import LoginForm from "./login-form";
import { auth } from "@/lib/auth/server";

export const metadata = {
  robots: { index: false, follow: false },
};

/** Signed-in visitors are bounced to the app; the form still prerenders. */
async function RedirectIfSignedIn() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");
  return null;
}

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-semibold tracking-tight">Trading Journal</span>
        <span className="text-sm text-muted-foreground">Sign in to your journal</span>
      </div>
      <LoginForm />
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
    </div>
  );
}
