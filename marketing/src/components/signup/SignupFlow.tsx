"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { SmelterLogo } from "@/components/Logo";

type Category = "fish" | "produce" | "dry_goods" | "packaging";

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  restaurantName: string;
  city: string;
  primaryCategory: Category | null;
  locationsCount: number;
  website: string; // Honeypot
}

const INITIAL_STATE: FormState = {
  fullName: "",
  email: "",
  phone: "",
  restaurantName: "",
  city: "",
  primaryCategory: null,
  locationsCount: 1,
  website: "",
};

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: "fish", label: "Fish" },
  { id: "produce", label: "Produce" },
  { id: "dry_goods", label: "Dry goods" },
  { id: "packaging", label: "Packaging" },
];

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
  const hpId = `${baseId}-website`;

  const isNameValid = formData.fullName.trim().length > 0;
  const isEmailValid = EMAIL_PATTERN.test(formData.email.trim());
  const canContinueStep1 = isNameValid && isEmailValid;

  const isRestValid = formData.restaurantName.trim().length > 0;
  const canSubmitStep2 = isRestValid && !isSubmitting;

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
    setTouched((prev) => ({ ...prev, restaurantName: true }));
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
          city: formData.city.trim() || undefined,
          primaryCategory: formData.primaryCategory || undefined,
          locationsCount: formData.locationsCount,
          website: formData.website || undefined,
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

  const requesterInitial = (
    formData.fullName.trim()[0] ||
    formData.email.trim()[0] ||
    "?"
  ).toUpperCase();

  const selectedCategoryLabel =
    CATEGORIES.find((c) => c.id === formData.primaryCategory)?.label ?? "None selected";

  return (
    <div className="w-full max-w-[440px] mx-auto px-4 py-8 sm:py-12">
      <div className="bg-card rounded-card border border-hairline p-6 sm:p-7 shadow-xs relative overflow-hidden transition-all duration-240 ease-out">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-6 mb-2">
          <Link href="/" className="inline-flex items-center" aria-label="smelter homepage">
            <SmelterLogo height={24} />
          </Link>
          <a
            href="https://dashboard.smelterpos.com"
            className="text-[13px] font-semibold text-ink2 hover:text-ink transition-colors"
          >
            Sign in
          </a>
        </div>

        {/* Step Progress Indicators */}
        <div className="flex items-center gap-1.5 mb-6" aria-hidden="true">
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

        {/* Honeypot field (hidden from view and accessibility) */}
        <div className="absolute left-[-9999px] top-[-9999px] opacity-0 pointer-events-none" aria-hidden="true">
          <label htmlFor={hpId}>Website</label>
          <input
            id={hpId}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
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

        {/* STEP 1: Account */}
        {step === 1 && (
          <form
            onSubmit={handleContinueStep1}
            noValidate
            className={`flex flex-col ${
              direction === "backward" ? "animate-slideBack" : "animate-slideIn"
            }`}
          >
            <h1 className="text-[26px] font-bold text-ink tracking-[-0.7px] leading-[1.1] mb-1.5">
              Create your account
            </h1>
            <p className="text-[14px] text-ink2 leading-[1.45] mb-5">
              Free for 14 days, no card needed. You&apos;ll invite your team once you&apos;re in.
            </p>

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
                  placeholder="Kevin Chen"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  onBlur={() => setTouched((prev) => ({ ...prev, fullName: true }))}
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                />
              </div>
              {touched.fullName && !isNameValid && (
                <p className="text-[12px] font-medium text-accent mt-1 animate-fadeIn" role="alert">
                  Please enter your full name.
                </p>
              )}
            </div>

            {/* Work email */}
            <div className="mb-3.5">
              <label htmlFor={emailId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                Work email
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
                  placeholder="you@restaurant.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                />
              </div>
              {touched.email && !isEmailValid && (
                <p className="text-[12px] font-medium text-accent mt-1 animate-fadeIn" role="alert">
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
                  placeholder="(555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                />
              </div>
            </div>

            {/* Submit Step 1 */}
            <button
              type="submit"
              disabled={!canContinueStep1}
              className={`w-full h-[48px] rounded-[10px] bg-accent text-white font-semibold text-[15px] transition-[opacity,transform] duration-150 active:scale-[0.99] flex items-center justify-center ${
                !canContinueStep1 ? "opacity-40 cursor-not-allowed" : "hover:brightness-105 cursor-pointer"
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

            {/* Footer */}
            <p className="text-[13px] text-ink2 text-center mt-6 pt-2 border-t border-hairline">
              Already have an account?{" "}
              <a
                href="https://dashboard.smelterpos.com"
                className="font-bold text-ink hover:text-accent transition-colors"
              >
                Sign in
              </a>
            </p>
          </form>
        )}

        {/* STEP 2: Restaurant */}
        {step === 2 && (
          <form
            onSubmit={handleSubmitStep2}
            noValidate
            className="flex flex-col animate-slideIn"
          >
            <div className="flex items-center justify-between mb-1.5">
              <h1 className="text-[26px] font-bold text-ink tracking-[-0.7px] leading-[1.1]">
                Name your restaurant
              </h1>
              <button
                type="button"
                onClick={handleBackToStep1}
                className="text-[13px] font-semibold text-accent hover:underline cursor-pointer"
              >
                Back
              </button>
            </div>
            <p className="text-[14px] text-ink2 leading-[1.45] mb-4">
              You can add more locations from the dashboard later.
            </p>

            {/* Who row */}
            <div className="flex items-center gap-2.5 rounded-[12px] border border-black/10 p-2.5 mb-4 bg-[#FAFAF9]">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-sm font-extrabold text-white">
                {requesterInitial}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <b className="block truncate text-[14px] font-bold text-ink">
                  {formData.fullName}
                </b>
                <span className="block truncate text-[12px] text-ink2">
                  {formData.email}
                </span>
              </div>
            </div>

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
                  placeholder="Babytuna Sushi"
                  value={formData.restaurantName}
                  onChange={(e) =>
                    setFormData({ ...formData, restaurantName: e.target.value })
                  }
                  onBlur={() => setTouched((prev) => ({ ...prev, restaurantName: true }))}
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                />
              </div>
              {touched.restaurantName && !isRestValid && (
                <p className="text-[12px] font-medium text-accent mt-1 animate-fadeIn" role="alert">
                  Please enter your restaurant name.
                </p>
              )}
            </div>

            {/* City (optional) */}
            <div className="mb-4">
              <label htmlFor={cityId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                City <span className="text-ink3 font-normal">(optional)</span>
              </label>
              <div className="flex items-center h-[46px] rounded-[10px] border border-black/15 bg-card px-3 focus-within:border-ink focus-within:ring-3 focus-within:ring-ink/10 transition-[border-color,box-shadow] duration-150">
                <input
                  id={cityId}
                  type="text"
                  placeholder="San Diego"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink3 outline-none"
                />
              </div>
            </div>

            {/* What do you mostly order? (Segmented chips) */}
            <div className="mb-4">
              <span className="block text-[13px] font-medium text-ink2 mb-2">
                What do you mostly order?
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Primary order category">
                {CATEGORIES.map((cat) => {
                  const isSelected = formData.primaryCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          primaryCategory: isSelected ? null : cat.id,
                        })
                      }
                      className={`px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-colors duration-150 cursor-pointer ${
                        isSelected
                          ? "bg-ink text-white border-ink"
                          : "bg-card text-ink border-black/15 hover:border-black/35"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
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
                  {formData.locationsCount} {formData.locationsCount === 1 ? "location" : "locations"}
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
                !canSubmitStep2 ? "opacity-40 cursor-not-allowed" : "hover:brightness-105 cursor-pointer"
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

            <h1 className="text-[26px] font-bold text-ink tracking-[-0.7px] leading-[1.1] mb-2">
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
              {formData.city && (
                <div className="flex justify-between items-baseline py-1.5 border-b border-hairline">
                  <span className="text-[12.5px] text-ink3">City</span>
                  <span className="text-[13.5px] font-medium text-ink">
                    {formData.city}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-baseline py-1.5 border-b border-hairline">
                <span className="text-[12.5px] text-ink3">Main order</span>
                <span className="text-[13.5px] font-medium text-ink">
                  {selectedCategoryLabel}
                </span>
              </div>
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

            {/* Fallback support link */}
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
  );
}
