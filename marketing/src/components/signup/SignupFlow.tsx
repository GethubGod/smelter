"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { SmelterLogo } from "@/components/Logo";

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  restaurantName: string;
  city: string;
  website: string;
  locationsCount: number;
  faxNumber: string; // Honeypot field (hidden from view)
}

const INITIAL_STATE: FormState = {
  fullName: "",
  email: "",
  phone: "",
  restaurantName: "",
  city: "",
  website: "",
  locationsCount: 1,
  faxNumber: "",
};

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function SignupFlow() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [formData, setFormData] = useState<FormState>(INITIAL_STATE);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const baseId = useId();
  const nameId = `${baseId}-name`;
  const emailId = `${baseId}-email`;
  const phoneId = `${baseId}-phone`;
  const restId = `${baseId}-restaurant`;
  const cityId = `${baseId}-city`;
  const webId = `${baseId}-website`;
  const hpId = `${baseId}-fax`;

  const isNameValid = formData.fullName.trim().length > 0;
  const isEmailValid = EMAIL_PATTERN.test(formData.email.trim());
  const canContinueStep1 = isNameValid && isEmailValid;

  const isRestValid = formData.restaurantName.trim().length > 0;
  const isCityValid = formData.city.trim().length > 0;
  const canSubmitStep2 = isRestValid && isCityValid && !isSubmitting;

  function handleContinueStep1(e: React.FormEvent) {
    e.preventDefault();
    setTouched((prev) => ({ ...prev, fullName: true, email: true }));
    if (canContinueStep1) {
      setDirection("forward");
      setStep(2);
    }
  }

  function handleBackToStep1() {
    setDirection("backward");
    setStep(1);
  }

  async function handleSubmitStep2(e: React.FormEvent) {
    e.preventDefault();
    setTouched((prev) => ({ ...prev, restaurantName: true, city: true }));
    if (!canSubmitStep2) return;

    setIsSubmitting(true);
    setServerError(null);
    setRateLimited(false);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || undefined,
          restaurantName: formData.restaurantName.trim(),
          city: formData.city.trim(),
          website: formData.website.trim() || undefined,
          locationsCount: formData.locationsCount,
          faxNumber: formData.faxNumber || undefined,
        }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        setIsSubmitting(false);
        return;
      }

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setServerError(
          typeof data?.error === "string"
            ? data.error
            : "Failed to submit request. Please try again.",
        );
        setIsSubmitting(false);
        return;
      }

      setDirection("forward");
      setStep(3);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full flex-1 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-black/[0.07] bg-[#FAFAF9]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center" aria-label="smelter homepage">
            <SmelterLogo height={26} />
          </Link>
          <a
            href="https://dashboard.smelterpos.com"
            className="text-[13.5px] font-semibold text-ink2 hover:text-ink transition-colors"
          >
            Sign in
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Left Column: Desktop Hero Information (Screenshot 3 style) */}
          <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col pt-2 pr-4">
            <h1 className="text-4xl xl:text-[46px] font-extrabold text-ink tracking-[-0.03em] leading-[1.12] mb-8">
              Talk to an expert to get set up.
            </h1>

            {/* What to expect */}
            <div className="mb-10">
              <p className="text-[16px] font-bold text-ink mb-4">What to expect:</p>
              <ol className="space-y-4 text-[15px] text-ink2 leading-relaxed">
                <li className="flex items-start gap-3.5">
                  <span className="flex-none font-bold text-ink">1.</span>
                  <span>Submit this form</span>
                </li>
                <li className="flex items-start gap-3.5">
                  <span className="flex-none font-bold text-ink">2.</span>
                  <span>We will reach out within 1 business day</span>
                </li>
                <li className="flex items-start gap-3.5">
                  <span className="flex-none font-bold text-ink">3.</span>
                  <span>Get started using smelter immediately</span>
                </li>
              </ol>
            </div>

            {/* Support link */}
            <div className="mb-14">
              <p className="text-[14.5px] text-ink2">
                Already using smelter?{" "}
                <Link
                  href="/support"
                  className="font-bold text-ink underline underline-offset-4 hover:text-accent transition-colors"
                >
                  Connect with Support
                </Link>
                .
              </p>
            </div>

            {/* Social Proof & Trust Badges */}
            <div className="pt-8 border-t border-black/[0.08]">
              <p className="text-[12.5px] font-bold uppercase tracking-wider text-ink3 mb-4">
                Built for modern restaurant teams
              </p>
              <div className="flex flex-wrap items-center gap-6 text-[13px] text-ink2 font-medium">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Fast 1-business-day onboarding
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  No card required
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Invite your managers later
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: The Form Card */}
          <div className="w-full lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-[460px] bg-card rounded-card border border-hairline p-6 sm:p-7 shadow-xs relative overflow-hidden transition-all duration-240 ease-out">
              {/* Card Header: Step Progress & Top-Right Back Button on Step 2 */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-1.5 flex-1 pr-3" aria-hidden="true">
                  <div
                    className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${
                      step >= 1 ? "bg-accent" : "bg-[#E5E5E3]"
                    }`}
                  />
                  <div
                    className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${
                      step >= 2 ? "bg-accent" : "bg-[#E5E5E3]"
                    }`}
                  />
                  <div
                    className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${
                      step >= 3 ? "bg-accent" : "bg-[#E5E5E3]"
                    }`}
                  />
                </div>
                <span className="sr-only">Step {step} of 3</span>

                {/* On Step 2, render Back button in top-right corner where Sign-in was */}
                {step === 2 && (
                  <button
                    type="button"
                    onClick={handleBackToStep1}
                    className="text-[13px] font-semibold text-accent hover:underline cursor-pointer pl-2 flex-none"
                  >
                    Back
                  </button>
                )}
              </div>

              {/* Honeypot field (hidden from view and screen readers) */}
              <div
                className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none"
                aria-hidden="true"
              >
                <label htmlFor={hpId}>Fax Number</label>
                <input
                  id={hpId}
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={formData.faxNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, faxNumber: e.target.value })
                  }
                />
              </div>

              {/* Rate limit banner */}
              {rateLimited && (
                <div
                  role="alert"
                  className="mb-5 rounded-[10px] border border-accent/25 bg-tint p-3.5 text-[13.5px] font-medium text-accent leading-snug animate-fadeIn"
                >
                  Too many requests from this address. Try again later.
                </div>
              )}

              {/* STEP 1: Account / Details */}
              {step === 1 && (
                <form
                  onSubmit={handleContinueStep1}
                  noValidate
                  className={`flex flex-col ${
                    direction === "backward" ? "animate-slideBack" : "animate-slideIn"
                  }`}
                >
                  {/* Title: On mobile "Talk to an expert", hidden on desktop since it's on left */}
                  <h1 className="lg:hidden text-[24px] font-bold text-ink tracking-[-0.6px] leading-[1.15] mb-2">
                    Talk to an expert
                  </h1>

                  {/* Mobile "What to expect" right under the title */}
                  <div className="lg:hidden mb-5 rounded-[10px] bg-[#F7F7F6] border border-black/[0.06] p-3.5 text-left">
                    <p className="text-[13px] font-bold text-ink mb-2">What to expect:</p>
                    <ol className="space-y-1.5 text-[12.5px] text-ink2 leading-snug">
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-ink">1.</span>
                        <span>Submit this form</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-ink">2.</span>
                        <span>We will reach out within 1 business day</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-ink">3.</span>
                        <span>Get started using smelter immediately</span>
                      </li>
                    </ol>
                  </div>

                  {/* Desktop Card Title */}
                  <h2 className="hidden lg:block text-[20px] font-bold text-ink tracking-[-0.4px] mb-5">
                    Your details
                  </h2>

                  {/* Full name */}
                  <div className="mb-3.5">
                    <label htmlFor={nameId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                      Full name
                    </label>
                    <div
                      className={`flex items-center h-[46px] rounded-[10px] border bg-card px-3 transition-[border-color,box-shadow] duration-150 ${
                        touched.fullName && !isNameValid
                          ? "border-accent ring-2 ring-accent/15"
                          : "border-black/15 focus-within:border-ink focus-within:ring-3 focus-within:ring-ink/10"
                      }`}
                    >
                      <input
                        id={nameId}
                        type="text"
                        required
                        autoComplete="name"
                        placeholder=""
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                        onBlur={() =>
                          setTouched((prev) => ({ ...prev, fullName: true }))
                        }
                        className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                      />
                    </div>
                    {touched.fullName && !isNameValid && (
                      <p
                        className="text-[12px] font-medium text-accent mt-1 animate-fadeIn"
                        role="alert"
                      >
                        Please enter your full name.
                      </p>
                    )}
                  </div>

                  {/* Email (updated from Work email) */}
                  <div className="mb-3.5">
                    <label htmlFor={emailId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                      Email
                    </label>
                    <div
                      className={`flex items-center h-[46px] rounded-[10px] border bg-card px-3 transition-[border-color,box-shadow] duration-150 ${
                        touched.email && !isEmailValid
                          ? "border-accent ring-2 ring-accent/15"
                          : "border-black/15 focus-within:border-ink focus-within:ring-3 focus-within:ring-ink/10"
                      }`}
                    >
                      <input
                        id={emailId}
                        type="email"
                        required
                        inputMode="email"
                        autoComplete="email"
                        placeholder=""
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                        className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                      />
                    </div>
                    {touched.email && !isEmailValid && (
                      <p
                        className="text-[12px] font-medium text-accent mt-1 animate-fadeIn"
                        role="alert"
                      >
                        Please enter a valid email address.
                      </p>
                    )}
                  </div>

                  {/* Phone (optional) */}
                  <div className="mb-5">
                    <label htmlFor={phoneId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                      Phone <span className="text-ink3 font-normal">(optional)</span>
                    </label>
                    <div className="flex items-center h-[46px] rounded-[10px] border border-black/15 bg-card px-3 focus-within:border-ink focus-within:ring-3 focus-within:ring-ink/10 transition-[border-color,box-shadow] duration-150">
                      <input
                        id={phoneId}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder=""
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                      />
                    </div>
                  </div>

                  {/* Continue Button */}
                  <button
                    type="submit"
                    disabled={!canContinueStep1}
                    className={`w-full h-[48px] rounded-[10px] bg-accent text-white font-semibold text-[15px] transition-[opacity,transform] duration-150 active:scale-[0.99] flex items-center justify-center ${
                      !canContinueStep1
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:brightness-105 cursor-pointer"
                    }`}
                  >
                    Continue
                  </button>

                  {/* Legal */}
                  <p className="text-[11.5px] text-ink3 text-center leading-relaxed mt-3.5">
                    By continuing you agree to the{" "}
                    <Link href="/terms" className="underline hover:text-ink transition-colors">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="underline hover:text-ink transition-colors">
                      Privacy policy
                    </Link>
                    .
                  </p>

                  {/* Mobile-only footer connect with support */}
                  <p className="lg:hidden text-[13px] text-ink2 text-center mt-5 pt-3 border-t border-hairline">
                    Already using smelter?{" "}
                    <Link
                      href="/support"
                      className="font-bold text-ink hover:text-accent transition-colors underline"
                    >
                      Connect with Support
                    </Link>
                  </p>
                </form>
              )}

              {/* STEP 2: Business name */}
              {step === 2 && (
                <form
                  onSubmit={handleSubmitStep2}
                  noValidate
                  className="flex flex-col animate-slideIn"
                >
                  <h1 className="text-[24px] font-bold text-ink tracking-[-0.6px] leading-[1.15] mb-5">
                    Business name
                  </h1>

                  {/* Restaurant name */}
                  <div className="mb-3.5">
                    <label htmlFor={restId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                      Restaurant name
                    </label>
                    <div
                      className={`flex items-center h-[46px] rounded-[10px] border bg-card px-3 transition-[border-color,box-shadow] duration-150 ${
                        touched.restaurantName && !isRestValid
                          ? "border-accent ring-2 ring-accent/15"
                          : "border-black/15 focus-within:border-ink focus-within:ring-3 focus-within:ring-ink/10"
                      }`}
                    >
                      <input
                        id={restId}
                        type="text"
                        required
                        placeholder=""
                        value={formData.restaurantName}
                        onChange={(e) =>
                          setFormData({ ...formData, restaurantName: e.target.value })
                        }
                        onBlur={() =>
                          setTouched((prev) => ({ ...prev, restaurantName: true }))
                        }
                        className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                      />
                    </div>
                    {touched.restaurantName && !isRestValid && (
                      <p
                        className="text-[12px] font-medium text-accent mt-1 animate-fadeIn"
                        role="alert"
                      >
                        Please enter your restaurant name.
                      </p>
                    )}
                  </div>

                  {/* City (now required) */}
                  <div className="mb-3.5">
                    <label htmlFor={cityId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                      City
                    </label>
                    <div
                      className={`flex items-center h-[46px] rounded-[10px] border bg-card px-3 transition-[border-color,box-shadow] duration-150 ${
                        touched.city && !isCityValid
                          ? "border-accent ring-2 ring-accent/15"
                          : "border-black/15 focus-within:border-ink focus-within:ring-3 focus-within:ring-ink/10"
                      }`}
                    >
                      <input
                        id={cityId}
                        type="text"
                        required
                        placeholder=""
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                        onBlur={() =>
                          setTouched((prev) => ({ ...prev, city: true }))
                        }
                        className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                      />
                    </div>
                    {touched.city && !isCityValid && (
                      <p
                        className="text-[12px] font-medium text-accent mt-1 animate-fadeIn"
                        role="alert"
                      >
                        Please enter your city.
                      </p>
                    )}
                  </div>

                  {/* Website link */}
                  <div className="mb-4">
                    <label htmlFor={webId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                      Website <span className="text-ink3 font-normal">(optional)</span>
                    </label>
                    <div className="flex items-center h-[46px] rounded-[10px] border border-black/15 bg-card px-3 focus-within:border-ink focus-within:ring-3 focus-within:ring-ink/10 transition-[border-color,box-shadow] duration-150">
                      <input
                        id={webId}
                        type="url"
                        placeholder=""
                        value={formData.website}
                        onChange={(e) =>
                          setFormData({ ...formData, website: e.target.value })
                        }
                        className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                      />
                    </div>
                  </div>

                  {/* Number of locations (Stepper) */}
                  <div className="mb-5">
                    <label className="block text-[13px] font-medium text-ink2 mb-1.5">
                      Number of locations
                    </label>
                    <div className="flex items-center justify-between h-[46px] rounded-[10px] border border-black/15 bg-card px-3">
                      <button
                        type="button"
                        aria-label="Decrease locations"
                        disabled={formData.locationsCount <= 1}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            locationsCount: Math.max(1, formData.locationsCount - 1),
                          })
                        }
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-ink text-[18px] font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F5F5F4] transition-colors cursor-pointer"
                      >
                        &minus;
                      </button>
                      <span className="text-[15px] font-bold text-ink">
                        {formData.locationsCount}{" "}
                        {formData.locationsCount === 1 ? "location" : "locations"}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase locations"
                        disabled={formData.locationsCount >= 20}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            locationsCount: Math.min(20, formData.locationsCount + 1),
                          })
                        }
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-ink text-[18px] font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F5F5F4] transition-colors cursor-pointer"
                      >
                        &#43;
                      </button>
                    </div>
                  </div>

                  {/* Server Error Message */}
                  {serverError && (
                    <div
                      role="alert"
                      className="mb-4 rounded-[10px] border border-accent/25 bg-tint p-3 text-[13px] font-medium text-accent animate-fadeIn"
                    >
                      {serverError}
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={!canSubmitStep2}
                    className={`w-full h-[48px] rounded-[10px] bg-accent text-white font-semibold text-[15px] transition-[opacity,transform] duration-150 active:scale-[0.99] flex items-center justify-center relative ${
                      !canSubmitStep2
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:brightness-105 cursor-pointer"
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white border-r-transparent animate-spin" />
                        <span>Submitting...</span>
                      </div>
                    ) : (
                      "Submit Request"
                    )}
                  </button>
                </form>
              )}

              {/* STEP 3: Done */}
              {step === 3 && (
                <div className="flex flex-col items-center text-center animate-slideIn">
                  {/* Green Check Ring (The ONLY green anywhere) */}
                  <div
                    className="w-[76px] h-[76px] rounded-full bg-[#E6F4EA] text-[#22883E] flex items-center justify-center my-4 animate-popRing"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-9 h-9"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>

                  <h1 className="text-[24px] font-bold text-ink tracking-[-0.6px] leading-[1.15] mb-2">
                    Request received
                  </h1>
                  <p className="text-[14px] text-ink2 leading-[1.45] mb-5 max-w-[340px]">
                    We will send your invite link by email within one business day. Open it on your phone and the smelter app takes it from there.
                  </p>

                  {/* Read-only summary card */}
                  <div className="w-full rounded-[14px] border border-black/10 bg-[#FAFAF9] p-4 text-left mb-6">
                    <div className="flex justify-between items-baseline py-1 border-b border-hairline">
                      <span className="text-[12.5px] text-ink3">Restaurant</span>
                      <span className="text-[13.5px] font-bold text-ink truncate ml-2">
                        {formData.restaurantName}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline py-1.5 border-b border-hairline">
                      <span className="text-[12.5px] text-ink3">Requester</span>
                      <span className="text-[13.5px] font-medium text-ink truncate ml-2">
                        {formData.email}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline py-1.5 border-b border-hairline">
                      <span className="text-[12.5px] text-ink3">City</span>
                      <span className="text-[13.5px] font-medium text-ink">
                        {formData.city}
                      </span>
                    </div>
                    {formData.website && (
                      <div className="flex justify-between items-baseline py-1.5 border-b border-hairline">
                        <span className="text-[12.5px] text-ink3">Website</span>
                        <span className="text-[13.5px] font-medium text-accent truncate ml-2">
                          {formData.website.replace(/^https?:\/\//, "")}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline pt-1.5">
                      <span className="text-[12.5px] text-ink3">Locations</span>
                      <span className="text-[13.5px] font-medium text-ink">
                        {formData.locationsCount}
                      </span>
                    </div>
                  </div>

                  {/* Action button */}
                  <Link
                    href="/"
                    className="w-full h-[48px] rounded-[10px] bg-accent text-white font-semibold text-[15px] flex items-center justify-center hover:brightness-105 transition-[opacity,transform] duration-150 active:scale-[0.99]"
                  >
                    Back to smelterpos.com
                  </Link>

                  {/* Support link */}
                  <p className="text-[13px] text-ink2 text-center mt-5">
                    Questions?{" "}
                    <Link
                      href="/support"
                      className="font-semibold text-ink hover:underline"
                    >
                      Visit support
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
