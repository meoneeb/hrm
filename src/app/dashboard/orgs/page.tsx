"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/ui/row-actions";

type Org = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  status: string;
  currency?: string;
  secondaryCurrency?: string | null;
  fxRate?: number;
};

const empty = {
  name: "",
  code: "",
  timezone: "Asia/Karachi",
  currency: "PKR",
  secondaryCurrency: "",
  fxRate: "1",
};

export default function OrgsPage() {
  const router = useRouter();
  const { data: orgs = [], error: swrError, mutate } = useSWR<Org[]>("/api/orgs");
  const [createForm, setCreateForm] = useState(empty);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await api<Org>("/api/orgs", {
        method: "POST",
        body: JSON.stringify({
          ...createForm,
          secondaryCurrency: createForm.secondaryCurrency || null,
          fxRate: Number(createForm.fxRate) || 1,
        }),
      });
      setCreateForm(empty);
      await mutate();
      if (res.data?.id) {
        router.push(`/dashboard/orgs/${res.data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function deactivate(o: Org) {
    if (!confirm(`Deactivate ${o.name}?`)) return;
    setPending(true);
    try {
      await api(`/api/orgs/${o.id}`, { method: "DELETE" });
      await mutate();
    } finally {
      setPending(false);
    }
  }

  const displayError =
    error || (swrError instanceof Error ? swrError.message : "");

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Create organizations and open one to manage details, shifts, and holidays."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>New organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Code</Label>
                <Input
                  value={createForm.code}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, code: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Timezone</Label>
                <Input
                  value={createForm.timezone}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, timezone: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Currency</Label>
                  <Input
                    value={createForm.currency}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, currency: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Secondary</Label>
                  <Input
                    value={createForm.secondaryCurrency}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        secondaryCurrency: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>FX rate</Label>
                <Input
                  type="number"
                  value={createForm.fxRate}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, fxRate: e.target.value })
                  }
                />
              </div>
              {displayError ? (
                <p className="text-sm text-red-400">{displayError}</p>
              ) : null}
              <Button type="submit" className="w-full" loading={pending}>
                Create org
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All orgs</CardTitle>
          </CardHeader>
          <CardContent>
            {orgs.length === 0 ? (
              <EmptyState message="No organizations yet." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Code</TH>
                    <TH>Currency</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {orgs.map((o) => (
                    <TR key={o.id}>
                      <TD>{o.name}</TD>
                      <TD className="text-gray-400">{o.code}</TD>
                      <TD className="text-gray-400">
                        {o.currency || "PKR"}
                        {o.secondaryCurrency
                          ? ` / ${o.secondaryCurrency}`
                          : ""}
                      </TD>
                      <TD>
                        <Badge
                          variant={o.status === "active" ? "success" : "muted"}
                        >
                          {o.status}
                        </Badge>
                      </TD>
                      <TD>
                        <RowActions
                          actions={[
                            {
                              label: "View",
                              variant: "view",
                              onClick: () =>
                                router.push(`/dashboard/orgs/${o.id}`),
                            },
                            {
                              label: "Edit",
                              variant: "edit",
                              onClick: () =>
                                router.push(`/dashboard/orgs/${o.id}?edit=1`),
                            },
                            {
                              label: "Deactivate",
                              variant: "delete",
                              onClick: () => deactivate(o),
                              disabled: o.status !== "active" || pending,
                            },
                          ]}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
