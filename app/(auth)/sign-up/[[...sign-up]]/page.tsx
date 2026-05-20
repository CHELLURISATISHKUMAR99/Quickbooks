import { SignUp } from "@clerk/nextjs";
import { COMPANY_NAME } from "@/lib/utils/constants";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="q4-logo">Q4</div>
        <h1 className="text-xl font-semibold text-neutral-900">{COMPANY_NAME}</h1>
        <p className="text-sm text-neutral-500">Create your account</p>
      </div>
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
