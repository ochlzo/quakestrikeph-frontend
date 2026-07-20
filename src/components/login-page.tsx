"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Mail,
  MapPinned,
  ShieldCheck,
  Waves,
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
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/db/supabase";
import { clearAppSessionCache } from "@/lib/app-session";
import {
  sanitizeEmailInput,
  sanitizeOtpInput,
  sanitizePasswordInput,
  validateEmailInput,
  validateOtpInput,
  validatePasswordInput,
} from "@/lib/input-security";
import { ensurePubUserRow, type PubUserProfile } from "@/lib/pubuser";
import { cn } from "@/lib/utils";

type LoginPageProps = {
  redirectTo?: string;
};

type AuthMode = "signIn" | "signUp";
type SignInStep = "password" | "otp";
type SignUpStep = "email" | "verify";
type SupabaseAuthError = {
  message?: unknown;
  status?: unknown;
  code?: unknown;
};

type StatusState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

const featureCards = [
  {
    icon: ShieldCheck,
    title: "Saved preferences",
    description: "Pick up where you left off with your filters and map view.",
  },
  {
    icon: Waves,
    title: "Forecast-aware tools",
    description: "See predictions, likelihoods, and follow-up details faster.",
  },
];

function buildRedirectUrl(target: string) {
  if (typeof window === "undefined") {
    return target;
  }

  try {
    return new URL(target, window.location.origin).toString();
  } catch {
    return window.location.origin;
  }
}

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

function isEmailNotConfirmedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as SupabaseAuthError;
  const code = String(authError.code ?? "").toLowerCase();
  const message = String(authError.message ?? "").toLowerCase();

  return (
    code === "email_not_confirmed" ||
    code === "email not confirmed" ||
    message.includes("email not confirmed")
  );
}

function isEmailDeliveryError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as SupabaseAuthError;
  const code = String(authError.code ?? "").toLowerCase();
  const message = String(authError.message ?? "").toLowerCase();

  return (
    code === "email_provider_disabled" ||
    code === "email_address_not_authorized" ||
    code === "over_email_send_rate_limit" ||
    message.includes("smtp") ||
    message.includes("email sending is not allowed") ||
    message.includes("rate limit")
  );
}

function isAccountInactiveError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as SupabaseAuthError;
  const code = String(authError.code ?? "").toLowerCase();
  const message = String(authError.message ?? "").toLowerCase();

  return (
    code === "user_banned" ||
    code.includes("banned") ||
    message.includes("banned") ||
    message.includes("deactivated") ||
    message.includes("inactive")
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
    >
      <path
        d="M21.35 11.1h-9.2v2.9h5.28c-.23 1.23-.93 2.28-2.02 2.98v2.48h3.25c1.9-1.75 2.99-4.33 2.99-7.4 0-.7-.06-1.23-.3-1.96Z"
        fill="#4285F4"
      />
      <path
        d="M12.15 21c2.7 0 4.96-.9 6.62-2.44l-3.25-2.48c-.9.6-2.05.96-3.37.96-2.59 0-4.79-1.75-5.57-4.11H3.25v2.56A9 9 0 0 0 12.15 21Z"
        fill="#34A853"
      />
      <path
        d="M6.58 12.93a5.4 5.4 0 0 1 0-3.46V6.91H3.25a9 9 0 0 0 0 8.58l3.33-2.56Z"
        fill="#FBBC05"
      />
      <path
        d="M12.15 5.5c1.47 0 2.78.51 3.82 1.51l2.87-2.87C17.1 2.56 14.85 1.5 12.15 1.5a9 9 0 0 0-8.9 5.41l3.33 2.56C7.36 7.25 9.56 5.5 12.15 5.5Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage({ redirectTo = "/" }: LoginPageProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [signInStep, setSignInStep] = useState<SignInStep>("password");
  const [signUpStep, setSignUpStep] = useState<SignUpStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isVerifyingSignUp, setIsVerifyingSignUp] = useState(false);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [status, setStatus] = useState<StatusState>({ kind: "idle" });
  const skipNextAuthRedirectRef = useRef(false);

  async function syncSignedInProfile(user: User) {
    try {
      return await ensurePubUserRow(user);
    } catch {
      return null;
    }
  }

  async function getPostLoginRedirect(userId: string, profile?: PubUserProfile | null) {
    let account = profile ?? null;

    if (!account) {
      const { data, error } = await supabase
        .from("PubUser")
        .select("role, account_status")
        .eq("auth_user_id", userId)
        .maybeSingle<{ role: string | null; account_status: string | null }>();

      if (!error) {
        account = data as PubUserProfile | null;
      }
    }

    if (account?.account_status === "inactive") {
      clearAppSessionCache();
      await supabase.auth.signOut();
      return null;
    }

    if (account?.role === "admin") {
      return "/admin";
    }

    return redirectTo;
  }

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        clearAppSessionCache();
        if (!session?.user) {
          return;
        }
        if (skipNextAuthRedirectRef.current) {
          skipNextAuthRedirectRef.current = false;
          return;
        }

        void (async () => {
          const profile = await syncSignedInProfile(session.user);

          const target = await getPostLoginRedirect(session.user.id, profile);
          if (!target) {
            setStatus({
              kind: "error",
              message: "This account is inactive. Contact an admin to reactivate it.",
            });
            return;
          }
          window.location.assign(buildRedirectUrl(target));
        })();
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [redirectTo]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus({ kind: "idle" });
    setNeedsEmailConfirmation(false);
    const emailResult = validateEmailInput(email);
    if (emailResult.error) {
      setEmail(emailResult.value);
      setStatus({ kind: "error", message: emailResult.error });
      return;
    }

    const passwordResult = validatePasswordInput(password, 1);
    if (passwordResult.error) {
      setPassword(passwordResult.value);
      setStatus({ kind: "error", message: passwordResult.error });
      return;
    }

    if (authMode === "signIn") {
      setIsSigningIn(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailResult.value,
        password: passwordResult.value,
      });

      setIsSigningIn(false);

      if (error) {
        if (isAccountInactiveError(error)) {
          setStatus({
            kind: "error",
            message: "This account is inactive. Contact an admin to reactivate it.",
          });
          return;
        }

        if (isEmailNotConfirmedError(error)) {
          setNeedsEmailConfirmation(true);
          const resendSucceeded = await handleResendConfirmation({
            suppressBusyState: true,
          });
          if (!resendSucceeded) {
            setStatus({
              kind: "error",
              message:
                "This account still needs email confirmation, but Supabase could not send the email yet. Check the project’s Auth email/SMTP settings.",
            });
          }
          return;
        }

        setStatus({
          kind: "error",
          message: getErrorMessage(error, "Unable to sign in right now."),
        });
        return;
      }

      const profile = data.session?.user
        ? await syncSignedInProfile(data.session.user)
        : null;

      const target = data.session?.user
        ? await getPostLoginRedirect(data.session.user.id, profile)
        : redirectTo;
      if (!target) {
        setStatus({
          kind: "error",
          message: "This account is inactive. Contact an admin to reactivate it.",
        });
        return;
      }
      window.location.assign(buildRedirectUrl(target));
      return;
    }
  }

  async function handleEmailOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailResult = validateEmailInput(email);
    if (emailResult.error) {
      setEmail(emailResult.value);
      setStatus({ kind: "error", message: emailResult.error });
      setSignInStep("password");
      return;
    }

    const otpResult = validateOtpInput(otp);
    if (otpResult.error) {
      setOtp(otpResult.value);
      setStatus({ kind: "error", message: otpResult.error });
      return;
    }

    setStatus({ kind: "idle" });
    setIsSendingLink(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email: emailResult.value,
      token: otpResult.value,
      type: "email",
    });

    setIsSendingLink(false);

    if (error) {
      if (isAccountInactiveError(error)) {
        setStatus({
          kind: "error",
          message: "This account is inactive. Contact an admin to reactivate it.",
        });
        return;
      }

      setStatus({
        kind: "error",
        message: getErrorMessage(
          error,
          "The code was not accepted. Please request a new one.",
        ),
      });
      return;
    }

    const profile = data.session?.user
      ? await syncSignedInProfile(data.session.user)
      : null;

    const target = data.session?.user
      ? await getPostLoginRedirect(data.session.user.id, profile)
      : redirectTo;
    if (!target) {
      setStatus({
        kind: "error",
        message: "This account is inactive. Contact an admin to reactivate it.",
      });
      return;
    }
    window.location.assign(buildRedirectUrl(target));
  }

  async function handleSendSignUpOtp(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    setStatus({ kind: "idle" });
    setNeedsEmailConfirmation(false);

    const emailResult = validateEmailInput(email);
    if (emailResult.error) {
      setEmail(emailResult.value);
      setStatus({ kind: "error", message: emailResult.error });
      return;
    }

    setIsSigningUp(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: emailResult.value,
      options: {
        shouldCreateUser: true,
      },
    });

    setIsSigningUp(false);

    if (error) {
      setStatus({
        kind: "error",
        message: getErrorMessage(
          error,
          "Unable to send the verification code right now.",
        ),
      });
      return;
    }

    setOtp("");
    setPassword("");
    setSignUpStep("verify");
    setStatus({
      kind: "success",
      message:
        "We sent a one-time code to your email. Enter it with your password to finish creating the account.",
    });
  }

  async function handleVerifySignUpOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailResult = validateEmailInput(email);
    if (emailResult.error) {
      setEmail(emailResult.value);
      setStatus({ kind: "error", message: emailResult.error });
      setSignUpStep("email");
      return;
    }

    const otpResult = validateOtpInput(otp);
    if (otpResult.error) {
      setOtp(otpResult.value);
      setStatus({ kind: "error", message: otpResult.error });
      return;
    }

    const passwordResult = validatePasswordInput(password);
    if (passwordResult.error) {
      setPassword(passwordResult.value);
      setStatus({ kind: "error", message: passwordResult.error });
      return;
    }

    setStatus({ kind: "idle" });
    setIsVerifyingSignUp(true);
    skipNextAuthRedirectRef.current = true;

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: emailResult.value,
      token: otpResult.value,
      type: "email",
    });

    if (verifyError) {
      skipNextAuthRedirectRef.current = false;
      setIsVerifyingSignUp(false);
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
      setIsVerifyingSignUp(false);
      setStatus({
        kind: "error",
        message: getErrorMessage(
          updateError,
          "The account was verified, but the password could not be saved.",
        ),
      });
      return;
    }

    const profile = data.session?.user
      ? await syncSignedInProfile(data.session.user)
      : null;

    setIsVerifyingSignUp(false);
    setStatus({
      kind: "success",
      message: "Account created. Redirecting to the dashboard.",
    });
    const target = data.session?.user
      ? await getPostLoginRedirect(data.session.user.id, profile)
      : redirectTo;
    if (!target) {
      setStatus({
        kind: "error",
        message: "This account is inactive. Contact an admin to reactivate it.",
      });
      return;
    }
    window.location.assign(buildRedirectUrl(target));
  }

  async function handleResendConfirmation(options?: {
    suppressBusyState?: boolean;
  }) {
    const emailResult = validateEmailInput(email);
    if (emailResult.error) {
      setEmail(emailResult.value);
      setStatus({ kind: "error", message: emailResult.error });
      return false;
    }

    setStatus({ kind: "idle" });
    if (!options?.suppressBusyState) {
      setIsResendingConfirmation(true);
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: emailResult.value,
      options: {
        emailRedirectTo: buildRedirectUrl(redirectTo),
      },
    });

    if (!options?.suppressBusyState) {
      setIsResendingConfirmation(false);
    }

    if (error) {
      if (isEmailDeliveryError(error)) {
        setStatus({
          kind: "error",
          message:
            "Supabase accepted the request, but its email service could not deliver the message. Check Auth logs and configure custom SMTP if you have not already.",
        });
        return false;
      }

      setStatus({
        kind: "error",
        message: getErrorMessage(
          error,
          "Unable to resend the confirmation email right now.",
        ),
      });
      return false;
    }

    setNeedsEmailConfirmation(false);
    setStatus({
      kind: "success",
      message: "Confirmation email sent. Check your inbox, then sign in again.",
    });
    return true;
  }

  async function handleGoogleSignIn() {
    setStatus({ kind: "idle" });
    setIsSigningInWithGoogle(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildRedirectUrl(redirectTo),
      },
    });

    setIsSigningInWithGoogle(false);

    if (error) {
      setStatus({ kind: "error", message: error.message });
    }
  }

  async function handleEmailOtpSignIn() {
    const emailResult = validateEmailInput(email);
    if (emailResult.error) {
      setEmail(emailResult.value);
      setStatus({ kind: "error", message: emailResult.error });
      return;
    }

    setStatus({ kind: "idle" });
    setIsSendingLink(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: emailResult.value,
      options: {
        shouldCreateUser: false,
      },
    });

    setIsSendingLink(false);

    if (error) {
      if (isAccountInactiveError(error)) {
        setStatus({
          kind: "error",
          message: "This account is inactive. Contact an admin to reactivate it.",
        });
        return;
      }

      setStatus({ kind: "error", message: error.message });
      return;
    }

    setStatus({
      kind: "success",
      message: "Check your inbox for a one-time sign-in code.",
    });
    setOtp("");
    setSignInStep("otp");
  }

  const isBusy =
    isSigningIn ||
    isSigningUp ||
    isVerifyingSignUp ||
    isSigningInWithGoogle ||
    isSendingLink ||
    isResendingConfirmation;

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
                {authMode === "signIn" ? "Login" : "Create account"}
              </h1>
            </div>
          </div>

          <Card className="[--card-spacing:--spacing(6)] shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <CardHeader>
              <CardTitle>
                {authMode === "signIn" ? "Welcome back" : "Join QuakeStrike PH"}
              </CardTitle>
              <CardDescription>
                {authMode === "signIn"
                  ? "Sign in to continue monitoring earthquakes, forecasts, and alerts."
                  : "Create an account to save preferences and keep using QuakeStrike PH."}
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

              {needsEmailConfirmation ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl"
                  disabled={isBusy}
                  onClick={() => {
                    void handleResendConfirmation();
                  }}
                >
                  {isResendingConfirmation ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Resending confirmation
                    </>
                  ) : (
                    <>
                      <Mail className="size-4" />
                      Resend confirmation email
                    </>
                  )}
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-center rounded-xl"
                disabled={isBusy}
                onClick={() => {
                  void handleGoogleSignIn();
                }}
              >
                {isSigningInWithGoogle ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Connecting with Google
                  </>
                ) : (
                  <>
                    <GoogleMark className="size-4" />
                    Continue with Google
                  </>
                )}
              </Button>

              <form
                className="space-y-4"
                onSubmit={
                  authMode === "signIn"
                    ? signInStep === "password"
                      ? handlePasswordSubmit
                      : handleEmailOtpSubmit
                    : signUpStep === "email"
                      ? handleSendSignUpOtp
                      : handleVerifySignUpOtp
                }
              >
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
                    readOnly={
                      (authMode === "signUp" && signUpStep === "verify") ||
                      (authMode === "signIn" && signInStep === "otp")
                    }
                    className={cn(
                      ((authMode === "signUp" && signUpStep === "verify") ||
                        (authMode === "signIn" && signInStep === "otp")) &&
                        "bg-muted/40",
                    )}
                    required
                  />
                </div>

                {(authMode === "signUp" && signUpStep === "verify") ||
                (authMode === "signIn" && signInStep === "otp") ? (
                  <div className="space-y-2">
                    <Label htmlFor="email-otp">One-time code</Label>
                    <Input
                      id="email-otp"
                      name="otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter the code from your email"
                      value={otp}
                      onChange={(event) =>
                        setOtp(sanitizeOtpInput(event.target.value))
                      }
                      required
                    />
                  </div>
                ) : null}

                {(authMode === "signIn" && signInStep === "password") ||
                (authMode === "signUp" && signUpStep === "verify") ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="password">Password</Label>
                      {authMode === "signIn" && signInStep === "password" ? (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs font-medium text-muted-foreground"
                          disabled={isBusy}
                          onClick={() => {
                            window.location.assign("/reset-password");
                          }}
                        >
                          Forgot password?
                        </Button>
                      ) : null}
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={
                        authMode === "signIn"
                          ? "current-password"
                          : "new-password"
                      }
                      placeholder={
                        authMode === "signIn"
                          ? "Enter your password"
                          : "Create a password"
                      }
                      value={password}
                      onChange={(event) =>
                        setPassword(sanitizePasswordInput(event.target.value))
                      }
                      required
                    />
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    className="h-11 flex-1 rounded-xl"
                    disabled={isBusy}
                  >
                    {authMode === "signIn" ? (
                      isSigningIn || isSendingLink ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          {signInStep === "password"
                            ? "Signing in"
                            : "Verifying code"}
                        </>
                      ) : signInStep === "otp" ? (
                        <>
                          Verify code
                          <ArrowRight className="size-4" />
                        </>
                      ) : (
                        <>
                          Login
                          <ArrowRight className="size-4" />
                        </>
                      )
                    ) : isSigningUp ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Sending code
                      </>
                    ) : isVerifyingSignUp ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Creating account
                      </>
                    ) : signUpStep === "email" ? (
                      <>
                        Send code
                        <Mail className="size-4" />
                      </>
                    ) : (
                      <>
                        Verify and create
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 rounded-xl"
                    disabled={isBusy}
                    onClick={() => {
                      if (authMode === "signIn" && signInStep === "password") {
                        void handleEmailOtpSignIn();
                      } else if (authMode === "signIn") {
                        setSignInStep("password");
                        setOtp("");
                        setStatus({ kind: "idle" });
                      } else if (signUpStep === "verify") {
                        void handleSendSignUpOtp();
                      } else {
                        setSignUpStep("email");
                        setOtp("");
                        setPassword("");
                        setAuthMode("signIn");
                        setStatus({ kind: "idle" });
                      }
                    }}
                  >
                    {authMode === "signIn" && signInStep === "password" ? (
                      isSendingLink ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          Sending link
                        </>
                      ) : (
                        <>
                          <Mail className="size-4" />
                          Email me a code
                        </>
                      )
                    ) : authMode === "signIn" ? (
                      <>
                        <ArrowRight className="size-4" />
                        Use password
                      </>
                    ) : signUpStep === "verify" ? (
                      isSigningUp ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          Resending code
                        </>
                      ) : (
                        <>
                          <Mail className="size-4" />
                          Resend code
                        </>
                      )
                    ) : (
                      <>
                        <ArrowRight className="size-4" />
                        Back to sign in
                      </>
                    )}
                  </Button>
                </div>

                {authMode === "signUp" && signUpStep === "verify" ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm font-medium text-muted-foreground"
                    disabled={isBusy}
                    onClick={() => {
                      setSignUpStep("email");
                      setOtp("");
                      setPassword("");
                      setStatus({ kind: "idle" });
                    }}
                  >
                    Change email
                  </Button>
                ) : null}
              </form>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {authMode === "signIn"
                    ? "No account yet?"
                    : "Already have an account?"}
                </span>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm font-medium text-foreground"
                  disabled={isBusy}
                  onClick={() => {
                    const nextMode =
                      authMode === "signIn" ? "signUp" : "signIn";
                    setAuthMode(nextMode);
                    setSignInStep("password");
                    setSignUpStep("email");
                    setOtp("");
                    setPassword("");
                    setStatus({ kind: "idle" });
                  }}
                >
                  {authMode === "signIn"
                    ? "Create an account"
                    : "Sign in instead"}
                </Button>
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-2">
                {featureCards.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <div
                      key={feature.title}
                      className="rounded-xl border border-border bg-muted/30 p-4"
                    >
                      <Icon className="size-5 text-muted-foreground" />
                      <h2 className="mt-3 text-sm font-semibold">
                        {feature.title}
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>

            <CardFooter className="items-start">
              <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                <p className="font-medium text-foreground">Need help?</p>
                <p>
                  Use the same email address associated with your QuakeStrike
                  account. Google sign-in, account creation, the email link
                  option, and password reset all work from this page.
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-[color:var(--destructive)]"
                >
                  <ArrowLeft className="size-3.5" />
                  Return to the map
                </a>
              </div>
            </CardFooter>
          </Card>

          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>Protected access for QuakeStrike PH</span>
            <span>Forecast-aware login</span>
          </div>
        </div>
      </main>
    </div>
  );
}
