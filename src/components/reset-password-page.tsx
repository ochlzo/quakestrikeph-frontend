"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  MapPinned,
} from "lucide-react";

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
  getPasswordErrorMessage,
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

type PasswordResetLogInsert = {
  auth_user_id: string;
  reset_email: string;
  status: "completed";
  completed_at: string;
  reset_type: "email_otp";
};

const RESEND_COOLDOWN_SECONDS = 60;
const RESET_REQUEST_MESSAGE =
  "If an account exists for that email, a password-reset code has been sent.";

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(
      (error as { message?: unknown }).message ?? "",
    ).trim();
    if (message && message !== "{}") {
      return message;
    }
  }

  if (typeof error === "string" && error.trim() && error !== "{}") {
    return error;
  }

  return fallback;
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function ResetPasswordPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<StatusState>({ kind: "idle" });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const resendRemainingSeconds = resendAvailableAt
    ? Math.ceil((resendAvailableAt - now) / 1000)
    : 0;
  const canResend = resendAvailableAt === null || resendRemainingSeconds <= 0;

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

    const { error: otpError } = await supabase.auth.resetPasswordForEmail(
      emailResult.value,
    );

    setIsSendingCode(false);

    if (otpError) {
      setStatus({
        kind: "error",
        message: getErrorMessage(
          otpError,
          "Unable to send the one-time code. Please check your email template and SMTP setup.",
        ),
      });
      return false;
    }

    const startedAt = Date.now();
    setResendAvailableAt(startedAt + RESEND_COOLDOWN_SECONDS * 1000);
    setStep("verify");
    setStatus({
      kind: "success",
      message: RESET_REQUEST_MESSAGE,
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

    const { data: verifyData, error: verifyError } =
      await supabase.auth.verifyOtp({
        email: emailResult.value,
        token: otpResult.value,
        type: "recovery",
      });

    if (verifyError) {
      setIsResettingPassword(false);
      setStatus({
        kind: "error",
        message: getErrorMessage(
          verifyError,
          "The code was not accepted. Please request a new one.",
        ),
      });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordResult.value,
    });

    if (updateError) {
      setIsResettingPassword(false);
      setStatus({
        kind: "error",
        message: getPasswordErrorMessage(
          updateError,
          "Unable to update the password right now.",
        ),
      });
      return;
    }

    if (verifyData.user) {
      const resetLog: PasswordResetLogInsert = {
        auth_user_id: verifyData.user.id,
        reset_email: emailResult.value,
        status: "completed",
        completed_at: new Date().toISOString(),
        reset_type: "email_otp",
      };

      await supabase.from("PasswordResetLog").insert(resetLog);
    }

    const { error: signOutError } = await supabase.auth.signOut({
      scope: "global",
    });

    setIsResettingPassword(false);

    if (signOutError) {
      setStatus({
        kind: "error",
        message:
          "Password updated, but other sessions could not be revoked. Please try signing out from all devices.",
      });
      return;
    }

    setStatus({
      kind: "success",
      message:
        "Password updated. Sign in again with your new password.",
    });

    window.location.assign("/login");
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
              <h1 className="text-xl font-semibold tracking-[-0.03em]">
                QuakeStrike PH
              </h1>
            </div>
          </div>

          <Card className="[--card-spacing:--spacing(6)] shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <CardHeader>
              <CardTitle>Reset your password</CardTitle>
              <CardDescription>
                Enter the same email used on your account. We&apos;ll send a
                one-time code, then you can set a new password.
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
                      onChange={(event) =>
                        setEmail(sanitizeEmailInput(event.target.value))
                      }
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl"
                    disabled={isSendingCode || !canResend}
                  >
                    {isSendingCode ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Sending code
                      </>
                    ) : !canResend ? (
                      <>
                        Resend available in{" "}
                        {formatCountdown(resendRemainingSeconds)}
                        <ArrowRight className="size-4" />
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
                      onChange={(event) =>
                        setOtp(sanitizeOtpInput(event.target.value))
                      }
                      aria-describedby="otp-timer"
                      required
                    />
                    <p id="otp-timer" className="text-xs text-muted-foreground">
                      Use the most recent code from your email. Supabase
                      enforces its expiration.
                    </p>
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
                      onChange={(event) =>
                        setNewPassword(
                          sanitizePasswordInput(event.target.value),
                        )
                      }
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
                        setStep("request");
                        setStatus({ kind: "idle" });
                        setOtp("");
                        setNewPassword("");
                      }}
                    >
                      Change email
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm font-medium text-muted-foreground"
                    disabled={
                      isSendingCode || isResettingPassword || !canResend
                    }
                    onClick={() => {
                      void sendCode();
                    }}
                  >
                    {canResend
                      ? "Resend code"
                      : `Resend available in ${formatCountdown(resendRemainingSeconds)}`}
                  </Button>
                </form>
              )}
            </CardContent>

            <CardFooter className="items-start">
              <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p className="font-medium text-foreground">Need help?</p>
                <p>
                  If the code expires, request a fresh one from this page. After
                  you reset your password, other sessions are revoked and
                  you&apos;ll be sent back to login.
                </p>
                <a
                  href="/login"
                  className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-[color:var(--destructive)]"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to login
                </a>
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
