"use client"

import * as React from "react"
import type { CSSProperties, ReactNode } from "react"
import type { User } from "@supabase/supabase-js"

import { AppSidebar } from "@/components/app-sidebar"
import { EarthquakeFilterSidebar } from "@/components/earthquake-filter-sidebar"
import { EarthquakeForecastSidebar } from "@/components/earthquake-forecast-sidebar"
import { searchEarthquakeMarkers, type EarthquakeMarker } from "@/data/earthquakes"
import {
  EARTHQUAKE_EVENTS_UPDATED_EVENT,
  EARTHQUAKE_FOCUS_EVENT,
  EARTHQUAKE_LOAD_MORE_EVENT,
  EARTHQUAKE_RENDER_EVENTS_EVENT,
  EARTHQUAKE_SELECTED_EVENT,
  createDefaultMapFilters,
  FILTERS_ACTIVE_EVENT,
  type EarthquakeMapFilters,
} from "@/lib/earthquake-map-filters"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { buttonVariants } from "@/components/ui/button"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { supabase } from "@/db/supabase"
import { cn } from "@/lib/utils"
import { BookmarkIcon, LoaderCircle, LockKeyholeIcon, LogInIcon, LogOutIcon, UserCircle2Icon } from "lucide-react"

type MapPageShellProps = { children: ReactNode }
type SearchStatus = "idle" | "loading" | "ready" | "error"
type FilteredEventState = {
  events: EarthquakeMarker[]
  hasMore: boolean
  atLimit: boolean
  loadingMore: boolean
}

type ProfileRow = {
  id: string
  is_admin: boolean
}

function dispatchRenderedEvents(events: EarthquakeMarker[], fitBounds = false) {
  document.dispatchEvent(new CustomEvent(EARTHQUAKE_RENDER_EVENTS_EVENT, {
    detail: { events, fitBounds },
  }))
}

function getDisplayName(user: User) {
  return (
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "Account"
  )
}

function getAvatarUrl(user: User) {
  return (
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    null
  )
}

function getInitials(user: User) {
  const name = getDisplayName(user)
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function AccountCenter() {
  const [user, setUser] = React.useState<User | null>(null)
  const [profile, setProfile] = React.useState<ProfileRow | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    let active = true

    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      const currentUser = data.user ?? null

      if (!currentUser) {
        if (active) {
          setUser(null)
          setProfile(null)
          setIsLoading(false)
        }
        return
      }

      const { data: profileData } = await supabase
        .from("users")
        .select("id, is_admin")
        .eq("id", currentUser.id)
        .maybeSingle<ProfileRow>()

      if (!active) return
      setUser(currentUser)
      setProfile(profileData ?? null)
      setIsLoading(false)
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setProfile(null)
      setIsLoading(false)
    })

    void loadUser()

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!isOpen) return
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  async function handleLogout() {
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    window.location.assign("/login?redirectTo=/dashboard")
  }

  if (isLoading) {
    return (
      <div className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background/80 px-3 text-xs font-medium text-muted-foreground shadow-sm">
        <LoaderCircle className="size-3.5 animate-spin" />
        Checking account
      </div>
    )
  }

  if (!user) {
    return (
      <a
        href="/login?redirectTo=/dashboard"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 rounded-full px-3 text-xs font-semibold shadow-sm",
        )}
      >
        <LogInIcon className="size-3.5" />
        Login / Sign in
      </a>
    )
  }

  const displayName = getDisplayName(user)
  const avatarUrl = getAvatarUrl(user)
  const isAdmin = profile?.is_admin === true

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
          <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback className="rounded-full">{getInitials(user)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-xs font-semibold text-foreground sm:inline-flex">
          Account center
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Logged in
        </span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Account center"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-xl"
        >
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-3">
            <Avatar className="h-10 w-10 rounded-full">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="rounded-full">{getInitials(user)}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </div>

          <div className="my-2 h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setIsOpen(false)
              window.location.assign("/change-password")
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
              setIsOpen(false)
              window.location.assign("/favorites")
            }}
          >
            <BookmarkIcon className="size-4" />
            Favorites
          </button>

          {isAdmin ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setIsOpen(false)
                window.location.assign("/admin")
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
              setIsOpen(false)
              void handleLogout()
            }}
          >
            <LogOutIcon className="size-4" />
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function MapPageContent({ children }: MapPageShellProps) {
  const { isMobile, setOpen, setOpenMobile } = useSidebar()
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [filteredEvents, setFilteredEvents] = React.useState<EarthquakeMarker[]>([])
  const [filteredHasMore, setFilteredHasMore] = React.useState(false)
  const [filteredAtLimit, setFilteredAtLimit] = React.useState(false)
  const [filteredLoadingMore, setFilteredLoadingMore] = React.useState(false)
  const filteredEventsRef = React.useRef<EarthquakeMarker[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchEvents, setSearchEvents] = React.useState<EarthquakeMarker[]>([])
  const [searchStatus, setSearchStatus] = React.useState<SearchStatus>("idle")
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [searchOffset, setSearchOffset] = React.useState(0)
  const [searchHasMore, setSearchHasMore] = React.useState(false)
  const [searchAtLimit, setSearchAtLimit] = React.useState(false)
  const [searchLoadingMore, setSearchLoadingMore] = React.useState(false)
  const [searchRetry, setSearchRetry] = React.useState(0)
  const searchRequest = React.useRef(0)
  const searchLoadingMoreRef = React.useRef(false)
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null)
  const [forecastEvent, setForecastEvent] = React.useState<EarthquakeMarker | null>(null)
  const [selectionVersion, setSelectionVersion] = React.useState(0)
  const [activeFilterCount, setActiveFilterCount] = React.useState(0)
  const [searchFilters, setSearchFilters] = React.useState(createDefaultMapFilters)
  const trimmedSearch = searchQuery.trim()
  const searchIsReady = trimmedSearch.length >= 3 && searchStatus === "ready"
  const visibleEvents = searchIsReady ? searchEvents : filteredEvents

  const openMainSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(true)
    else setOpen(true)
  }, [isMobile, setOpen, setOpenMobile])

  const selectEarthquake = React.useCallback((eventId: string) => {
    setSelectedEventId(eventId)
    setSelectionVersion((version) => version + 1)
  }, [])

  React.useEffect(() => {
    const updateEvents = (event: Event) => {
      const detail = (event as CustomEvent<FilteredEventState>).detail
      filteredEventsRef.current = detail.events
      setFilteredEvents(detail.events)
      setFilteredHasMore(detail.hasMore)
      setFilteredAtLimit(detail.atLimit)
      setFilteredLoadingMore(detail.loadingMore)
    }
    const selectEvent = (event: Event) => {
      const selected = (event as CustomEvent<EarthquakeMarker>).detail
      if (selected.hasForecast) setFilterPanelOpen(false)
      selectEarthquake(selected.id)
      setForecastEvent(selected.hasForecast ? selected : null)
      if (isMobile && selected.hasForecast) setOpenMobile(false)
      else openMainSidebar()
    }
    const updateFilterStatus = (event: Event) => {
      setActiveFilterCount((event as CustomEvent<number>).detail)
    }
    const updateSearchFilters = (event: Event) => {
      setSearchFilters((event as CustomEvent<EarthquakeMapFilters>).detail)
    }

    document.addEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents)
    document.addEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent)
    document.addEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus)
    document.addEventListener("quakestrike:filters", updateSearchFilters)
    return () => {
      document.removeEventListener(EARTHQUAKE_EVENTS_UPDATED_EVENT, updateEvents)
      document.removeEventListener(EARTHQUAKE_SELECTED_EVENT, selectEvent)
      document.removeEventListener(FILTERS_ACTIVE_EVENT, updateFilterStatus)
      document.removeEventListener("quakestrike:filters", updateSearchFilters)
    }
  }, [isMobile, openMainSidebar, selectEarthquake, setOpenMobile])

  React.useEffect(() => {
    const requestId = ++searchRequest.current
    if (trimmedSearch.length < 3) {
      setSearchEvents([])
      setSearchStatus("idle")
      setSearchError(null)
      setSearchOffset(0)
      setSearchHasMore(false)
      setSearchAtLimit(false)
      setSearchLoadingMore(false)
      searchLoadingMoreRef.current = false
      dispatchRenderedEvents(filteredEventsRef.current)
      return
    }

    setSearchStatus("loading")
    setSearchError(null)
    setSearchOffset(0)
    setSearchHasMore(false)
    setSearchAtLimit(false)
    setSearchLoadingMore(false)
    searchLoadingMoreRef.current = false
    dispatchRenderedEvents(filteredEventsRef.current)
    const timer = window.setTimeout(async () => {
      try {
        const page = await searchEarthquakeMarkers(trimmedSearch, searchFilters)
        if (searchRequest.current !== requestId) return
        setSearchEvents(page.events)
        setSearchOffset(page.nextOffset)
        setSearchHasMore(page.hasMore)
        setSearchAtLimit(page.atLimit)
        setSearchStatus("ready")
        dispatchRenderedEvents(page.events, true)
      } catch {
        if (searchRequest.current !== requestId) return
        setSearchStatus("error")
        setSearchError("Could not search all earthquake events.")
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchFilters, searchRetry, trimmedSearch])

  function openFilters() {
    if (isMobile) setOpenMobile(false)
    setFilterPanelOpen(true)
  }

  function setFiltersOpen(open: boolean) {
    setFilterPanelOpen(open)
    if (!open && isMobile && !forecastEvent) setOpenMobile(true)
  }

  function filtersApplied() {
    if (isMobile) {
      setFilterPanelOpen(false)
      if (!forecastEvent) setOpenMobile(true)
    }
  }

  function closeForecast() {
    setForecastEvent(null)
    if (isMobile) setOpenMobile(true)
  }

  function focusEarthquake(event: EarthquakeMarker) {
    selectEarthquake(event.id)
    setForecastEvent((current) => current ? (event.hasForecast ? event : null) : null)
    document.dispatchEvent(new CustomEvent(EARTHQUAKE_FOCUS_EVENT, {
      detail: { id: event.id, latitude: event.latitude, longitude: event.longitude },
    }))
    if (isMobile) setOpenMobile(false)
  }

  async function loadMoreEvents() {
    if (!searchIsReady) {
      if (filteredHasMore && !filteredLoadingMore && !filteredAtLimit) {
        document.dispatchEvent(new Event(EARTHQUAKE_LOAD_MORE_EVENT))
      }
      return
    }
    if (!searchHasMore || searchAtLimit || searchLoadingMoreRef.current) return

    const requestId = searchRequest.current
    searchLoadingMoreRef.current = true
    setSearchLoadingMore(true)
    setSearchError(null)
    try {
      const page = await searchEarthquakeMarkers(trimmedSearch, searchFilters, searchOffset)
      if (searchRequest.current !== requestId) return
      const events = [...searchEvents, ...page.events]
      setSearchEvents(events)
      setSearchOffset(page.nextOffset)
      setSearchHasMore(page.hasMore)
      setSearchAtLimit(page.atLimit)
      dispatchRenderedEvents(events)
    } catch {
      if (searchRequest.current === requestId) {
        setSearchError("Could not load more earthquake events.")
      }
    } finally {
      searchLoadingMoreRef.current = false
      if (searchRequest.current === requestId) setSearchLoadingMore(false)
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
          forecastEvent || filterPanelOpen ? "w-80 border-r" : "w-0"
        )}
      >
        <EarthquakeForecastSidebar event={forecastEvent} covered={filterPanelOpen} onClose={closeForecast} />
        <EarthquakeFilterSidebar open={filterPanelOpen} onOpenChange={setFiltersOpen} onApplied={filtersApplied} />
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
  )
}

export function MapPageShell({ children }: MapPageShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen style={{ "--sidebar-width": "350px" } as CSSProperties}>
        <MapPageContent>{children}</MapPageContent>
      </SidebarProvider>
    </TooltipProvider>
  )
}
