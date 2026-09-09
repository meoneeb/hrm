"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShell } from "@/components/layout/shell-context";

const CODES = ["PKR", "USD", "EUR", "GBP", "AED", "INR", "SAR"];
const NONE = "__none__";

export function Footer() {
  const { user, orgId, currentOrg, refreshOrgs } = useShell();
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState(currentOrg?.currency || "PKR");
  const [secondaryCurrency, setSecondary] = useState(
    currentOrg?.secondaryCurrency || ""
  );
  const [fxRate, setFxRate] = useState(String(currentOrg?.fxRate || 1));
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const canEdit = user.type === "superAdmin" || user.type === "orgAdmin";

  async function save() {
    if (!orgId) return;
    setError("");
    setMsg("");
    setPending(true);
    try {
      await api(`/api/orgs/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify({
          currency,
          secondaryCurrency: secondaryCurrency || null,
          fxRate: Number(fxRate) || 1,
        }),
      });
      setMsg("Saved");
      await refreshOrgs();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  function openEditor() {
    setCurrency(currentOrg?.currency || "PKR");
    setSecondary(currentOrg?.secondaryCurrency || "");
    setFxRate(String(currentOrg?.fxRate || 1));
    setOpen(true);
  }

  return (
    <footer className="border-t border-white/5 bg-card px-4 py-3 md:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-400">
          {currentOrg ? (
            <>
              Base:{" "}
              <span className="text-white">{currentOrg.currency || "PKR"}</span>
              {currentOrg.secondaryCurrency ? (
                <>
                  {" · "}Secondary:{" "}
                  <span className="text-teal-400">
                    {currentOrg.secondaryCurrency}
                  </span>
                  {" · "}Rate:{" "}
                  <span className="text-white">{currentOrg.fxRate}</span>
                </>
              ) : (
                <span className="text-gray-500"> · No secondary currency</span>
              )}
            </>
          ) : (
            <span>Select an organization to manage currency</span>
          )}
        </div>
        {canEdit && orgId ? (
          <Button size="sm" variant="outline" onClick={openEditor}>
            Change currency
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change currency</DialogTitle>
            <DialogDescription>
              Amounts are stored in base currency. Secondary is for display
              conversion (fxRate = base units per 1 secondary).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Base currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CODES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Secondary currency</Label>
              <Select
                value={secondaryCurrency || NONE}
                onValueChange={(v) => setSecondary(v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {CODES.filter((c) => c !== currency).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>FX rate (base per 1 secondary)</Label>
              <Input
                type="number"
                min={0.0001}
                step="any"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {msg ? <p className="text-sm text-teal-400">{msg}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={save} loading={pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
