import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import RegisterForm from "./register-form";
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

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/brand/logo.png"
          alt="Trading Journal logo"
          width={84}
          height={56}
          priority
          className="rounded-xl"
        />
        <span className="text-lg font-semibold tracking-tight">Trading Journal</span>
        <span className="text-sm text-muted-foreground">
          Create your trading journal
        </span>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
    </div>
  );
}
