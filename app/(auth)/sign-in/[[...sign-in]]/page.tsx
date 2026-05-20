import { SignIn } from "@clerk/nextjs";
import { COMPANY_NAME } from "@/lib/utils/constants";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="q4-logo">Q4</div>
        <h1 className="text-xl font-semibold text-neutral-900">{COMPANY_NAME}</h1>
        <p className="text-sm text-neutral-500">Sign in to your portal</p>
      </div>
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
