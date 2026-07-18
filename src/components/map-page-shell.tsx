"use client";

import * as React from "react";
import type { CSSProperties, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

import { AlertPreferencesDialog } from "@/components/alert-preferences-dialog";
import { AppSidebar } from "@/components/app-sidebar";
import { EarthquakeFilterSidebar } from "@/components/earthquake-filter-sidebar";
import { EarthquakeForecastSidebar } from "@/components/earthquake-forecast-sidebar";
import {
  searchEarthquakeMarkers,
  type EarthquakeMarker,
} from "@/data/earthquakes";
import {
  EARTHQUAKE_EVENTS_UPDATED_EVENT,
  EARTHQUAKE_EVENTS_REQUEST_EVENT,
  EARTHQUAKE_FOCUS_EVENT,
  EARTHQUAKE_LOAD_MORE_EVENT,
  EARTHQUAKE_RENDER_EVENTS_EVENT,
  EARTHQUAKE_SELECTED_EVENT,
  createDefaultMapFilters,
  FILTERS_ACTIVE_EVENT,
  type EarthquakeMapFilters,
} from "@/lib/earthquake-map-filters";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/db/supabase";
import {
  ensurePubUserRow,
  getPubUserDisplayName,
  getPubUserProfile,
  updatePubUserProfile,
  type AlertPreferences,
  type PubUserProfile,
} from "@/lib/pubuser";
import {
  sanitizeNameInput,
  sanitizePhoneInput,
  validateMobileNumberInput,
} from "@/lib/input-security";
import { cn } from "@/lib/utils";
import {
  BellRingIcon,
  LoaderCircle,
  LockKeyholeIcon,
  LogInIcon,
  LogOutIcon,
  MapPin,
  PencilIcon,
  UserCircle2Icon,
} from "lucide-react";

type MapPageShellProps = { children: ReactNode };
type SearchStatus = "idle" | "loading" | "ready" | "error";
type FilteredEventState = {
  events: EarthquakeMarker[];
  hasMore: boolean;
  atLimit: boolean;
  loadingMore: boolean;
};

type ProfileRow = {
  Email: string | null;
  DisplayName: string | null;
  FName: string | null;
  Mname: string | null;
  LName: string | null;
  MobileNum: string | null;
};

const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  alerts_on: false,
  phivolcs_only: false,
  near_pins_only: false,
};

function dispatchRenderedEvents(events: EarthquakeMarker[], fitBounds = false) {
  document.dispatchEvent(
    new CustomEvent(EARTHQUAKE_RENDER_EVENTS_EVENT, {
      detail: { events, fitBounds },
    }),
  );
}

function getDisplayName(user: User) {
  return (
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "Account"
  );
}

function getAvatarUrl(user: User) {
  return user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;
}

function getInitialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(
      (error as { message?: unknown }).message ?? "",
    ).trim();
    if (message) {
      return message;
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function getProfileFormValues(profile: PubUserProfile | null) {
  return {
    firstName: profile?.FName ?? "",
    middleName: profile?.Mname ?? "",
    lastName: profile?.LName ?? "",
    displayName: getPubUserDisplayName(profile),
    mobileNum: profile?.MobileNum ?? "",
  };
}

function AccountCenter() {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<ProfileRow | null>(null);
  const [firstName, setFirstName] = React.useState("");
  const [middleName, setMiddleName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [displayNameInput, setDisplayNameInput] = React.useState("");
  const [mobileNum, setMobileNum] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isAlertPreferencesOpen, setIsAlertPreferencesOpen] = React.useState(false);
  const [alertPreferences, setAlertPreferences] = React.useState(DEFAULT_ALERT_PREFERENCES);
  const [status, setStatus] = React.useState<{
    kind: "idle" | "error" | "success";
    message: string;
  }>({
    kind: "idle",
    message: "",
  });
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const { data } = await supabase.auth.getUser();
        const currentUser = data.user ?? null;

        if (!currentUser) {
          if (active) {
            setUser(null);
            setProfile(null);
            setFirstName("");
            setMiddleName("");
            setLastName("");
            setDisplayNameInput("");
            setMobileNum("");
            setAlertPreferences(DEFAULT_ALERT_PREFERENCES);
            setIsEditingProfile(false);
          }
          return;
        }

        if (active) {
          setUser(currentUser);
        }

        try {
          await ensurePubUserRow(currentUser);
        } catch {
          // If the sync fails, the next protected page can retry.
        }

        let profileData: PubUserProfile | null = null;
        try {
          profileData = await getPubUserProfile(currentUser.email ?? "");
        } catch {
          profileData = null;
        }

        if (!active) return;
        setProfile(profileData);
        const formValues = getProfileFormValues(profileData);
        setFirstName(formValues.firstName);
        setMiddleName(formValues.middleName);
        setLastName(formValues.lastName);
        setDisplayNameInput(formValues.displayName);
        setMobileNum(formValues.mobileNum);
        setAlertPreferences({
          alerts_on: profileData?.alerts_on ?? false,
          phivolcs_only: profileData?.phivolcs_only ?? false,
          near_pins_only: profileData?.near_pins_only ?? false,
        });
        setIsEditingProfile(false);
      } catch {
        if (active) {
          setUser(null);
          setProfile(null);
          setFirstName("");
          setMiddleName("");
          setLastName("");
          setDisplayNameInput("");
          setMobileNum("");
          setAlertPreferences(DEFAULT_ALERT_PREFERENCES);
          setIsEditingProfile(false);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          setUser(null);
          setProfile(null);
          setFirstName("");
          setMiddleName("");
          setLastName("");
          setDisplayNameInput("");
          setMobileNum("");
          setAlertPreferences(DEFAULT_ALERT_PREFERENCES);
          setIsEditingProfile(false);
          setIsLoading(false);
          return;
        }

        void loadUser();
      },
    );

    void loadUser();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!isOpen) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleLogout() {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    window.location.assign("/login?redirectTo=/");
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    if (!user.email) return;

    setStatus({ kind: "idle", message: "" });
    const mobileNumberResult = validateMobileNumberInput(mobileNum);
    if (mobileNumberResult.error) {
      setMobileNum(mobileNumberResult.value);
      setStatus({ kind: "error", message: mobileNumberResult.error });
      return;
    }

    setIsSavingProfile(true);

    try {
      await updatePubUserProfile(user.email, {
        FName: firstName,
        Mname: middleName,
        LName: lastName,
        DisplayName: displayNameInput,
        MobileNum: mobileNumberResult.value,
      });
      const updatedProfile = await getPubUserProfile(user.email);
      setProfile(updatedProfile);
      const formValues = getProfileFormValues(updatedProfile);
      setFirstName(formValues.firstName);
      setMiddleName(formValues.middleName);
      setLastName(formValues.lastName);
      setDisplayNameInput(formValues.displayName);
      setMobileNum(formValues.mobileNum);
      setIsEditingProfile(false);
      setStatus({
        kind: "success",
        message: "Accounts saved successfully.",
      });
    } catch (error) {
      console.error("Failed to save PubUser profile", error);
      setStatus({
        kind: "error",
        message: getErrorMessage(
          error,
          "We could not save your account details right now.",
        ),
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  function cancelProfileEdit() {
    const formValues = getProfileFormValues(profile as PubUserProfile);
    setFirstName(formValues.firstName);
    setMiddleName(formValues.middleName);
    setLastName(formValues.lastName);
    setDisplayNameInput(formValues.displayName);
    setMobileNum(formValues.mobileNum);
    setStatus({ kind: "idle", message: "" });
    setIsEditingProfile(false);
  }

  if (isLoading) {
    return (
      <div className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background/80 px-3 text-xs font-medium text-muted-foreground shadow-sm">
        <LoaderCircle className="size-3.5 animate-spin" />
        Checking account
      </div>
    );
  }

  if (!user) {
    return (
      <a
        href="/login?redirectTo=/"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 rounded-full px-3 text-xs font-semibold shadow-sm",
        )}
      >
        <LogInIcon className="size-3.5" />
        Login / Sign in
      </a>
    );
  }

  const avatarUrl = getAvatarUrl(user);
  const email = profile?.Email ?? user.email ?? "";
  const accountDisplayName = profile
    ? getPubUserDisplayName(profile as PubUserProfile)
    : getDisplayName(user);
  const isAdmin =
    user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin";
  const isProfileComplete = Boolean(
    profile?.DisplayName?.trim() ||
    profile?.FName?.trim() ||
    profile?.Mname?.trim() ||
    profile?.LName?.trim() ||
    profile?.MobileNum?.trim(),
  );

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-9 rounded-full px-2.5 shadow-sm",
        )}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((value) => !value)}
      >
        <Avatar className="h-7 w-7 rounded-full">
          <AvatarImage src={avatarUrl ?? undefined} alt={accountDisplayName} />
          <AvatarFallback className="rounded-full">
            {getInitialsFromName(accountDisplayName)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-xs font-semibold text-foreground sm:inline-flex">
          Account center
        </span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Account center"
          className="absolute right-0 z-50 mt-2 w-[min(92vw,26rem)] max-h-[calc(100svh-5rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-xl"
        >
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-3">
            <Avatar className="h-10 w-10 rounded-full">
              <AvatarImage
                src={avatarUrl ?? undefined}
                alt={accountDisplayName}
              />
              <AvatarFallback className="rounded-full">
                {getInitialsFromName(accountDisplayName)}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{accountDisplayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>

          <div className="px-1 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Account center
                </p>
                <h2 className="text-sm font-semibold tracking-[-0.02em]">
                  Complete your user profile
                </h2>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {!isProfileComplete ? (
                  <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Needs setup
                  </span>
                ) : null}
                {!isEditingProfile ? (
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-8 rounded-full px-3 text-xs",
                    )}
                    onClick={() => {
                      setStatus({ kind: "idle", message: "" });
                      setIsEditingProfile(true);
                    }}
                  >
                    <PencilIcon className="size-3.5" />
                    Edit
                  </button>
                ) : null}
              </div>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleProfileSave}>
              <div className="space-y-2">
                <Label
                  htmlFor="account-email"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="account-email"
                  value={email}
                  readOnly
                  className="h-10 rounded-xl bg-muted/40"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="account-first-name"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    First name
                  </Label>
                  <Input
                    id="account-first-name"
                    value={firstName}
                    onChange={(event) =>
                      setFirstName(sanitizeNameInput(event.target.value))
                    }
                    placeholder="First name"
                    readOnly={!isEditingProfile}
                    className={cn(
                      "h-10 rounded-xl",
                      !isEditingProfile && "bg-muted/40",
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="account-middle-name"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Middle name
                  </Label>
                  <Input
                    id="account-middle-name"
                    value={middleName}
                    onChange={(event) =>
                      setMiddleName(sanitizeNameInput(event.target.value))
                    }
                    placeholder="Middle name"
                    readOnly={!isEditingProfile}
                    className={cn(
                      "h-10 rounded-xl",
                      !isEditingProfile && "bg-muted/40",
                    )}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="account-last-name"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Last name
                  </Label>
                  <Input
                    id="account-last-name"
                    value={lastName}
                    onChange={(event) =>
                      setLastName(sanitizeNameInput(event.target.value))
                    }
                    placeholder="Last name"
                    readOnly={!isEditingProfile}
                    className={cn(
                      "h-10 rounded-xl",
                      !isEditingProfile && "bg-muted/40",
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="account-mobile"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Mobile number
                  </Label>
                  <Input
                    id="account-mobile"
                    type="tel"
                    inputMode="numeric"
                    pattern="09[0-9]{9}"
                    maxLength={11}
                    value={mobileNum}
                    onChange={(event) =>
                      setMobileNum(sanitizePhoneInput(event.target.value))
                    }
                    placeholder="09123456789"
                    readOnly={!isEditingProfile}
                    aria-invalid={
                      status.kind === "error" &&
                      status.message.includes("Mobile number")
                    }
                    className={cn(
                      "h-10 rounded-xl",
                      !isEditingProfile && "bg-muted/40",
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="account-display-name"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Display name
                </Label>
                <Input
                  id="account-display-name"
                  value={displayNameInput}
                  onChange={(event) =>
                    setDisplayNameInput(sanitizeNameInput(event.target.value))
                  }
                  placeholder="Display name"
                  readOnly={!isEditingProfile}
                  className={cn(
                    "h-10 rounded-xl",
                    !isEditingProfile && "bg-muted/40",
                  )}
                />
              </div>

              {status.kind !== "idle" ? (
                <p
                  className={cn(
                    "w-fit rounded-xl border px-3 py-2 text-xs",
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

              {isEditingProfile ? (
                <div className="flex items-center justify-end gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "h-9 rounded-full px-4",
                      )}
                      disabled={isSavingProfile}
                      onClick={cancelProfileEdit}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" }),
                        "h-9 rounded-full px-4",
                      )}
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? "Saving..." : "Save profile"}
                    </button>
                  </div>
                </div>
              ) : null}
            </form>
          </div>

          <Separator className="my-2" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setIsOpen(false);
              window.location.assign("/change-password");
            }}
          >
            <LockKeyholeIcon className="size-4" />
            Change password
          </button>

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setIsOpen(false);
              window.location.assign("/pins");
            }}
          >
            <MapPin className="size-4" />
            Pinned Locations
          </button>

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setIsOpen(false);
              setIsAlertPreferencesOpen(true);
            }}
          >
            <BellRingIcon className="size-4" />
            Alert preferences
          </button>

          {isAdmin ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setIsOpen(false);
                window.location.assign("/admin");
              }}
            >
              <UserCircle2Icon className="size-4" />
              Admin dashboard
            </button>
          ) : null}

          <div className="my-2 h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            disabled={isLoggingOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            onClick={() => {
              setIsOpen(false);
              void handleLogout();
            }}
          >
            <LogOutIcon className="size-4" />
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      ) : null}
      <AlertPreferencesDialog
        open={isAlertPreferencesOpen}
        initialValue={alertPreferences}
        onOpenChange={setIsAlertPreferencesOpen}
        onSaved={setAlertPreferences}
      />
    </div>
  );
}

function MapPageContent({ children }: MapPageShellProps) {
  const { isMobile, setOpen, setOpenMobile } = useSidebar();
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false);
  const [filteredEvents, setFilteredEvents] = React.useState<
    EarthquakeMarker[]
  >([]);
  const [filteredHasMore, setFilteredHasMore] = React.useState(false);
  const [filteredAtLimit, setFilteredAtLimit] = React.useState(false);
  const [filteredLoadingMore, setFilteredLoadingMore] = React.useState(false);
  const filteredEventsRef = React.useRef<EarthquakeMarker[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchEvents, setSearchEvents] = React.useState<EarthquakeMarker[]>(
    [],
  );
  const [searchStatus, setSearchStatus] = React.useState<SearchStatus>("idle");
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchOffset, setSearchOffset] = React.useState(0);
  const [searchHasMore, setSearchHasMore] = React.useState(false);
  const [searchAtLimit, setSearchAtLimit] = React.useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = React.useState(false);
  const [searchRetry, setSearchRetry] = React.useState(0);
  const searchRequest = React.useRef(0);
  const searchLoadingMoreRef = React.useRef(false);
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null,
  );
  const [forecastEvent, setForecastEvent] =
    React.useState<EarthquakeMarker | null>(null);
  const [selectionVersion, setSelectionVersion] = React.useState(0);
  const [activeFilterCount, setActiveFilterCount] = React.useState(0);
  const [searchFilters, setSearchFilters] = React.useState(
    createDefaultMapFilters,
  );
  const trimmedSearch = searchQuery.trim();
  const searchIsReady = trimmedSearch.length >= 3 && searchStatus === "ready";
  const visibleEvents = searchIsReady ? searchEvents : filteredEvents;

  const openMainSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(true);
    else setOpen(true);
  }, [isMobile, setOpen, setOpenMobile]);

  const selectEarthquake = React.useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setSelectionVersion((version) => version + 1);
  }, []);

  React.useEffect(() => {
    const updateEvents = (event: Event) => {
      const detail = (event as CustomEvent<FilteredEventState>).detail;
      filteredEventsRef.current = detail.events;
      setFilteredEvents(detail.events);
      setFilteredHasMore(detail.hasMore);
      setFilteredAtLimit(detail.atLimit);
      setFilteredLoadingMore(detail.loadingMore);
    };
    const selectEvent = (event: Event) => {
      const selected = (event as CustomEvent<EarthquakeMarker>).detail;
      if (selected.hasForecast) setFilterPanelOpen(false);
      selectEarthquake(selected.id);
      setForecastEvent(selected.hasForecast ? selected : null);
      if (isMobile && selected.hasForecast) setOpenMobile(false);
      else openMainSidebar();
    };
    const updateFilterStatus = (event: Event) => {
      setActiveFilterCount((event as CustomEvent<number>).detail);
    };
    const updateSearchFilters = (event: Event) => {
      setSearchFilters((event as CustomEvent<EarthquakeMapFilters>).detail);
    };

    document.addEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents);
    document.addEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent);
    document.addEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus);
    document.addEventListener("quakestrike:filters", updateSearchFilters);
    document.dispatchEvent(new Event(EARTHQUAKE_EVENTS_REQUEST_EVENT));
    return () => {
      document.removeEventListener(
        EARTHQUAKE_EVENTS_UPDATED_EVENT,
        updateEvents,
      );
      document.removeEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent);
      document.removeEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus);
      document.removeEventListener("quakestrike:filters", updateSearchFilters);
    };
  }, [isMobile, openMainSidebar, selectEarthquake, setOpenMobile]);

  React.useEffect(() => {
    const requestId = ++searchRequest.current;
    if (trimmedSearch.length < 3) {
      setSearchEvents([]);
      setSearchStatus("idle");
      setSearchError(null);
      setSearchOffset(0);
      setSearchHasMore(false);
      setSearchAtLimit(false);
      setSearchLoadingMore(false);
      searchLoadingMoreRef.current = false;
      dispatchRenderedEvents(filteredEventsRef.current);
      return;
    }

    setSearchStatus("loading");
    setSearchError(null);
    setSearchOffset(0);
    setSearchHasMore(false);
    setSearchAtLimit(false);
    setSearchLoadingMore(false);
    searchLoadingMoreRef.current = false;
    dispatchRenderedEvents(filteredEventsRef.current);
    const timer = window.setTimeout(async () => {
      try {
        const page = await searchEarthquakeMarkers(
          trimmedSearch,
          searchFilters,
        );
        if (searchRequest.current !== requestId) return;
        setSearchEvents(page.events);
        setSearchOffset(page.nextOffset);
        setSearchHasMore(page.hasMore);
        setSearchAtLimit(page.atLimit);
        setSearchStatus("ready");
        dispatchRenderedEvents(page.events, true);
      } catch {
        if (searchRequest.current !== requestId) return;
        setSearchStatus("error");
        setSearchError("Could not search all earthquake events.");
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchFilters, searchRetry, trimmedSearch]);

  function openFilters() {
    if (isMobile) setOpenMobile(false);
    setFilterPanelOpen(true);
  }

  function setFiltersOpen(open: boolean) {
    setFilterPanelOpen(open);
    if (!open && isMobile && !forecastEvent) setOpenMobile(true);
  }

  function filtersApplied() {
    if (isMobile) {
      setFilterPanelOpen(false);
      if (!forecastEvent) setOpenMobile(true);
    }
  }

  function closeForecast() {
    setForecastEvent(null);
    if (isMobile) setOpenMobile(true);
  }

  function focusEarthquake(event: EarthquakeMarker) {
    selectEarthquake(event.id);
    setForecastEvent((current) =>
      current ? (event.hasForecast ? event : null) : null,
    );
    document.dispatchEvent(
      new CustomEvent(EARTHQUAKE_FOCUS_EVENT, {
        detail: {
          id: event.id,
          latitude: event.latitude,
          longitude: event.longitude,
        },
      }),
    );
    if (isMobile) setOpenMobile(false);
  }

  async function loadMoreEvents() {
    if (!searchIsReady) {
      if (filteredHasMore && !filteredLoadingMore && !filteredAtLimit) {
        document.dispatchEvent(new Event(EARTHQUAKE_LOAD_MORE_EVENT));
      }
      return;
    }
    if (!searchHasMore || searchAtLimit || searchLoadingMoreRef.current) return;

    const requestId = searchRequest.current;
    searchLoadingMoreRef.current = true;
    setSearchLoadingMore(true);
    setSearchError(null);
    try {
      const page = await searchEarthquakeMarkers(
        trimmedSearch,
        searchFilters,
        searchOffset,
      );
      if (searchRequest.current !== requestId) return;
      const events = [...searchEvents, ...page.events];
      setSearchEvents(events);
      setSearchOffset(page.nextOffset);
      setSearchHasMore(page.hasMore);
      setSearchAtLimit(page.atLimit);
      dispatchRenderedEvents(events);
    } catch {
      if (searchRequest.current === requestId) {
        setSearchError("Could not load more earthquake events.");
      }
    } finally {
      searchLoadingMoreRef.current = false;
      if (searchRequest.current === requestId) setSearchLoadingMore(false);
    }
  }

  return (
    <>
      <AppSidebar
        events={visibleEvents}
        selectedEventId={selectedEventId}
        selectionVersion={selectionVersion}
        searchQuery={searchQuery}
        searchLoading={searchStatus === "loading"}
        globalSearchActive={searchIsReady}
        searchError={searchError}
        loadingMore={searchIsReady ? searchLoadingMore : filteredLoadingMore}
        hasMore={searchIsReady ? searchHasMore : filteredHasMore}
        atLimit={searchIsReady ? searchAtLimit : filteredAtLimit}
        activeFilterCount={activeFilterCount}
        onSearchQueryChange={setSearchQuery}
        onRetrySearch={() => setSearchRetry((value) => value + 1)}
        onLoadMore={loadMoreEvents}
        onOpenFilters={openFilters}
        onSelectEvent={focusEarthquake}
      />
      <div
        className={cn(
          "relative hidden h-svh shrink-0 overflow-hidden border-sidebar-border transition-[width] duration-200 ease-linear md:block",
          forecastEvent || filterPanelOpen ? "w-80 border-r" : "w-0",
        )}
      >
        <EarthquakeForecastSidebar
          event={forecastEvent}
          covered={filterPanelOpen}
          onClose={closeForecast}
        />
        <EarthquakeFilterSidebar
          open={filterPanelOpen}
          onOpenChange={setFiltersOpen}
          onApplied={filtersApplied}
        />
      </div>
      <SidebarInset className="isolate flex h-svh min-w-0 flex-col overflow-hidden">
        <header className="relative z-10 flex h-12 shrink-0 items-center justify-between gap-3 bg-background/95 px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1" />
          <AccountCenter />
        </header>
        <div className="relative z-0 h-[calc(100svh-3rem)] min-h-0 overflow-hidden px-2 pb-2">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}

export function MapPageShell({ children }: MapPageShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen
        style={{ "--sidebar-width": "350px" } as CSSProperties}
      >
        <MapPageContent>{children}</MapPageContent>
      </SidebarProvider>
    </TooltipProvider>
  );
}
