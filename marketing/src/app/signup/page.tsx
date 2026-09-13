import type { Metadata } from "next";
import { SignupFlow } from "@/components/signup/SignupFlow";

export const metadata: Metadata = {
  title: "Talk to an expert | smelter",
  description: "Talk to an expert to get set up with smelter for your restaurant.",
};

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#FAFAF9] text-ink antialiased">
      <SignupFlow />
    </main>
  );
}
