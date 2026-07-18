"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  updatePubUserAlertPreferences,
  type AlertPreferences,
} from "@/lib/pubuser";

type AlertPreferencesDialogProps = {
  open: boolean;
  initialValue: AlertPreferences;
  onOpenChange: (open: boolean) => void;
  onSaved: (preferences: AlertPreferences) => void;
};

export function AlertPreferencesDialog({
  open,
  initialValue,
  onOpenChange,
  onSaved,
}: AlertPreferencesDialogProps) {
  const [showPrompt, setShowPrompt] = React.useState(!initialValue.alerts_on);
  const [alertsOn, setAlertsOn] = React.useState(initialValue.alerts_on);
  const [phivolcsOnly, setPhivolcsOnly] = React.useState(initialValue.phivolcs_only);
  const [nearPinsOnly, setNearPinsOnly] = React.useState(initialValue.near_pins_only);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setShowPrompt(!initialValue.alerts_on);
    setAlertsOn(initialValue.alerts_on);
    setPhivolcsOnly(initialValue.phivolcs_only);
    setNearPinsOnly(initialValue.near_pins_only);
  }, [
    open,
    initialValue.alerts_on,
    initialValue.phivolcs_only,
    initialValue.near_pins_only,
  ]);

  function handleAlertsChange(enabled: boolean) {
    setAlertsOn(enabled);
    if (!enabled) {
      setPhivolcsOnly(false);
      setNearPinsOnly(false);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const preferences = {
      alerts_on: alertsOn,
      phivolcs_only: alertsOn && phivolcsOnly,
      near_pins_only: alertsOn && nearPinsOnly,
    };

    setIsSaving(true);
    try {
      const saved = await updatePubUserAlertPreferences(preferences);
      onSaved(saved);
      onOpenChange(false);
      toast.success("Alert preferences saved.");
    } catch (error) {
      console.error("Failed to save alert preferences", error);
      toast.error("We could not save your alert preferences right now.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {showPrompt ? (
          <>
            <DialogHeader>
              <DialogTitle>Receive earthquake alerts?</DialogTitle>
              <DialogDescription>
                Turn on alerts to choose when QuakeStrike PH may notify you.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  setAlertsOn(true);
                  setShowPrompt(false);
                }}
              >
                Yes, continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form className="contents" onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Alert preferences</DialogTitle>
              <DialogDescription>
                Choose which earthquake alerts you want to receive.
              </DialogDescription>
            </DialogHeader>

            <div className="divide-y divide-border rounded-xl border border-border">
              <label className="flex cursor-pointer items-start gap-3 p-4">
                <input
                  type="checkbox"
                  checked={alertsOn}
                  onChange={(event) => handleAlertsChange(event.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <span className="block font-medium">Receive alerts</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Turn earthquake alert notifications on or off.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-4 p-4 has-[:disabled]:cursor-not-allowed">
                <span>
                  <span className="block font-medium">Receive PHIVOLCS alerts only</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    When on, you will receive alerts only when PHIVOLCS sends them. When off, you
                    will receive both system and PHIVOLCS alerts.
                  </span>
                </span>
                <Switch
                  checked={phivolcsOnly}
                  onCheckedChange={setPhivolcsOnly}
                  disabled={!alertsOn}
                  aria-label="Receive PHIVOLCS alerts only"
                  className="mt-0.5"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-4 p-4 has-[:disabled]:cursor-not-allowed">
                <span>
                  <span className="block font-medium">
                    Receive alerts only for events near saved pins
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Only receive an alert when the trigger event is near one of your configured
                    saved pins.
                  </span>
                </span>
                <Switch
                  checked={nearPinsOnly}
                  onCheckedChange={setNearPinsOnly}
                  disabled={!alertsOn}
                  aria-label="Receive alerts only for events near saved pins"
                  className="mt-0.5"
                />
              </label>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save preferences"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
