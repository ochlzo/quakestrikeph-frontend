"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, MapPinned } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/db/supabase";
import {
  sanitizeEmailInput,
  sanitizeOtpInput,
  sanitizePasswordInput,
  validateEmailInput,
  validateOtpInput,
  validatePasswordInput,
} from "@/lib/input-security";
import { cn } from "@/lib/utils";

type StatusState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

type Step = "request" | "verify";

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim()
    if (message && message !== "{}") {
      return message
    }
  }

  if (typeof error === "string" && error.trim() && error !== "{}") {
    return error
  }

  return fallback
}

export function ResetPasswordPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [status, setStatus] = useState<StatusState>({ kind: "idle" });

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await sendCode();
  }

  async function sendCode() {
    const emailResult = validateEmailInput(email);
    if (emailResult.error) {
      setEmail(emailResult.value);
      setStatus({ kind: "error", message: emailResult.error });
      return false;
    }

    setStatus({ kind: "idle" });
    setIsSendingCode(true);

    const { error } = await supabase.auth.resetPasswordForEmail(emailResult.value);

    setIsSendingCode(false);

    if (error) {
      setStatus({
        kind: "error",
        message: getErrorMessage(error, "Unable to send the one-time code. Please check your email template and SMTP setup."),
      });
      return false;
    }

    setStep("verify");
    setStatus({
      kind: "success",
      message: "We sent a one-time code to your email. Enter it below with your new password.",
    });

    return true;
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailResult = validateEmailInput(email);
    if (emailResult.error) {
      setEmail(emailResult.value);
      setStatus({ kind: "error", message: emailResult.error });
      setStep("request");
      return;
    }

    const otpResult = validateOtpInput(otp);
    if (otpResult.error) {
      setOtp(otpResult.value);
      setStatus({ kind: "error", message: otpResult.error });
      return;
    }

    const passwordResult = validatePasswordInput(newPassword);
    if (passwordResult.error) {
      setNewPassword(passwordResult.value);
      setStatus({ kind: "error", message: passwordResult.error });
      return;
    }

    setStatus({ kind: "idle" });
    setIsResettingPassword(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: emailResult.value,
      token: otpResult.value,
      type: "recovery",
    });

    if (verifyError) {
      setIsResettingPassword(false);
      setStatus({
        kind: "error",
        message: getErrorMessage(verifyError, "The code was not accepted. Please request a new one."),
      });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordResult.value,
    });

    setIsResettingPassword(false);

    if (updateError) {
      setStatus({
        kind: "error",
        message: getErrorMessage(updateError, "Unable to update the password right now."),
      });
      return;
    }

    setStatus({
      kind: "success",
      message: "Password updated. Redirecting to the dashboard.",
    });

    window.location.assign("/");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(248,113,113,0.16),_transparent_28%),linear-gradient(180deg,_var(--background),_color-mix(in_oklch,var(--background),var(--foreground)_2%))] text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(to_right,rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.1)_1px,transparent_1px)] [background-size:44px_44px]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-center gap-3 md:justify-start">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
              <MapPinned className="size-5 text-[color:var(--destructive)]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                QuakeStrike PH
              </p>
              <h1 className="text-xl font-semibold tracking-[-0.03em]">
                Change password
              </h1>
            </div>
          </div>

          <Card className="[--card-spacing:--spacing(6)] shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <CardHeader>
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-muted/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-[color:var(--destructive)]" />
                Password recovery
              </div>
              <CardTitle>Reset your password</CardTitle>
              <CardDescription>
                Enter your email first. We&apos;ll send a one-time code, then you can set a new password.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {status.kind !== "idle" ? (
                <p
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm",
                    status.kind === "error" &&
                      "border-destructive/20 bg-destructive/10 text-destructive",
                    status.kind === "success" &&
                      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  )}
                  role={status.kind === "error" ? "alert" : "status"}
                >
                  {status.message}
                </p>
              ) : null}

              {step === "request" ? (
                <form className="space-y-4" onSubmit={handleSendCode}>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(event) => setEmail(sanitizeEmailInput(event.target.value))}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl"
                    disabled={isSendingCode}
                  >
                    {isSendingCode ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Sending code
                      </>
                    ) : (
                      <>
                        Send one-time code
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={handleResetPassword}>
                  <div className="space-y-2">
                    <Label htmlFor="otp">One-time code</Label>
                    <Input
                      id="otp"
                      name="otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter the code from your email"
                      value={otp}
                      onChange={(event) => setOtp(sanitizeOtpInput(event.target.value))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New password</Label>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Enter a new password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(sanitizePasswordInput(event.target.value))}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="submit"
                      className="h-11 flex-1 rounded-xl"
                      disabled={isResettingPassword}
                    >
                      {isResettingPassword ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          Updating password
                        </>
                      ) : (
                        <>
                          Reset password
                          <LockKeyhole className="size-4" />
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 rounded-xl"
                      disabled={isSendingCode || isResettingPassword}
                      onClick={() => {
                        setStep("request")
                        setStatus({ kind: "idle" })
                        setOtp("")
                        setNewPassword("")
                      }}
                    >
                      Change email
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm font-medium text-muted-foreground"
                    disabled={isSendingCode || isResettingPassword}
                    onClick={() => {
                      void sendCode()
                    }}
                  >
                    Resend code
                  </Button>
                </form>
              )}
            </CardContent>

            <CardFooter className="items-start">
              <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p className="font-medium text-foreground">Need help?</p>
                <p>
                  If the code expires, request a fresh one from this page. After you reset your password, you&apos;ll be sent back to the dashboard.
                </p>
                <a
                  href="/login"
                  className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-[color:var(--destructive)]"
                >
                  Back to login
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  )
}
