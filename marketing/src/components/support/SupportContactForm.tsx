"use client";

import { useId, useState } from "react";

export function SupportContactForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const baseId = useId();
  const nameId = `${baseId}-name`;
  const emailId = `${baseId}-email`;
  const phoneId = `${baseId}-phone`;
  const messageId = `${baseId}-message`;

  const hasContactMethod = email.trim().length > 0 || phone.trim().length > 0;
  const canSubmit = name.trim().length > 0 && hasContactMethod && message.trim().length > 0 && !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!hasContactMethod) {
      setError("Please provide an email address or phone number.");
      return;
    }
    if (!message.trim()) {
      setError("Please describe what you need help with.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          message: message.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to send message. Please try emailing support@smelterpos.com directly.");
        setIsSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again or email support@smelterpos.com directly.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
    setError(null);
    setSubmitted(false);
    setIsOpen(false);
  }

  return (
    <div className="not-prose my-6">
      {/* Top Banner Card */}
      <div className="rounded-[14px] border border-black/10 bg-[#FAFAF9] p-5 sm:p-6 transition-all duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-ink mb-1">
              Contact support directly
            </h2>
            <p className="text-[13.5px] text-ink2">
              Have a problem with the app or need help? Reach our team directly.
            </p>
          </div>
          {!isOpen && !submitted && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center justify-center h-[42px] px-5 rounded-[10px] bg-accent text-white text-[14px] font-semibold hover:brightness-105 transition-all shadow-xs cursor-pointer flex-none self-start sm:self-auto"
            >
              Contact Support
            </button>
          )}
        </div>

        {/* Form Container */}
        {isOpen && !submitted && (
          <form onSubmit={handleSubmit} noValidate className="mt-6 pt-5 border-t border-hairline animate-fadeIn">
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor={nameId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                  Your name <span className="text-accent">*</span>
                </label>
                <input
                  id={nameId}
                  type="text"
                  required
                  placeholder=""
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-[44px] rounded-[9px] border border-black/15 bg-card px-3 text-[14.5px] text-ink placeholder:text-ink3 focus:border-ink focus:ring-3 focus:ring-ink/10 transition-all outline-none"
                />
              </div>

              {/* Email & Phone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={emailId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                    Email address
                  </label>
                  <input
                    id={emailId}
                    type="email"
                    placeholder=""
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-[44px] rounded-[9px] border border-black/15 bg-card px-3 text-[14.5px] text-ink placeholder:text-ink3 focus:border-ink focus:ring-3 focus:ring-ink/10 transition-all outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={phoneId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                    Phone number
                  </label>
                  <input
                    id={phoneId}
                    type="tel"
                    placeholder=""
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-[44px] rounded-[9px] border border-black/15 bg-card px-3 text-[14.5px] text-ink placeholder:text-ink3 focus:border-ink focus:ring-3 focus:ring-ink/10 transition-all outline-none"
                  />
                </div>
              </div>
              <p className="text-[12px] text-ink3">
                Please provide an email or phone number so we can get back to you.
              </p>

              {/* Problem / Message */}
              <div>
                <label htmlFor={messageId} className="block text-[13px] font-medium text-ink2 mb-1.5">
                  Describe your problem or question <span className="text-accent">*</span>
                </label>
                <textarea
                  id={messageId}
                  required
                  rows={4}
                  placeholder="Tell us what screen you were on, what went wrong, or what you need assistance with..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-[9px] border border-black/15 bg-card p-3 text-[14.5px] text-ink placeholder:text-ink3 focus:border-ink focus:ring-3 focus:ring-ink/10 transition-all outline-none resize-y"
                />
              </div>

              {/* Error Banner */}
              {error && (
                <div role="alert" className="rounded-[8px] bg-tint border border-accent/25 p-3 text-[13px] font-medium text-accent animate-fadeIn">
                  {error}
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`h-[42px] px-5 rounded-[10px] bg-accent text-white text-[14px] font-semibold transition-all cursor-pointer ${
                    !canSubmit ? "opacity-40 cursor-not-allowed" : "hover:brightness-105 active:scale-[0.99]"
                  }`}
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="h-[42px] px-4 rounded-[10px] text-ink2 text-[14px] font-medium hover:bg-black/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Confirmation Screen */}
        {submitted && (
          <div className="mt-6 pt-5 border-t border-hairline flex flex-col items-center text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#22883E] flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h3 className="text-[17px] font-bold text-ink mb-1">
              Support request sent
            </h3>
            <p className="text-[14px] text-ink2 max-w-sm mb-4">
              Thank you for reaching out. An expert will review your message and get back to you within one business day.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="text-[13px] font-semibold text-accent hover:underline cursor-pointer"
            >
              Send another message
            </button>
          </div>
        )}

        {/* Direct Email Line */}
        <div className="mt-4 pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink2">
          <span>
            Direct email:{" "}
            <a
              href="mailto:support@smelterpos.com"
              className="font-bold text-ink underline hover:text-accent transition-colors"
            >
              support@smelterpos.com
            </a>
          </span>
          <span className="text-ink3">Response time: Within 1 business day</span>
        </div>
      </div>
    </div>
  );
}
