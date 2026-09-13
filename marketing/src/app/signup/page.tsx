import type { Metadata } from "next";
import { SignupFlow } from "@/components/signup/SignupFlow";

export const metadata: Metadata = {
  title: "Sign up | smelter",
  description: "Request access to smelter for your restaurant.",
};

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center py-6 sm:py-12 bg-cream">
      <SignupFlow />
    </main>
  );
}
