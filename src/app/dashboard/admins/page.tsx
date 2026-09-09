"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { PageHeader, EmptyState, Select } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/ui/row-actions";

type Admin = {
  id: string;
  name: string;
  email: string;
  primary: boolean;
  active: boolean;
  orgIds: string[];
  orgId?: string | null;
};

type Org = { id: string; name: string; code: string };

export default function ClientsPage() {
  const { data: session } = useSession();
  const [filterOrg, setFilterOrg] = useState("");
  const [filterPrimary, setFilterPrimary] = useState("");
  const [editing, setEditing] = useState<Admin | null>(null);
  const [form, setForm] = useState({
    orgName: "",
    orgCode: "",
    timezone: "UTC",
    currency: "PKR",
    secondaryCurrency: "USD",
    fxRate: "280",
    adminName: "",
    email: "",
    password: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    password: "",
    orgIds: [] as string[],
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [secondaryForm, setSecondaryForm] = useState({
    name: "",
    email: "",
    password: "",
    orgIds: [] as string[],
  });

  const isSuper = session?.user?.type === "superAdmin";
  const isPrimaryOA =
    session?.user?.type === "orgAdmin" && session.user.primary;

  const canManage = isSuper || isPrimaryOA;

  const adminsQs = useMemo(() => {
    const qs = new URLSearchParams({ type: "orgAdmin" });
    if (filterOrg) qs.set("orgId", filterOrg);
    if (filterPrimary) qs.set("primary", filterPrimary);
    return qs.toString();
  }, [filterOrg, filterPrimary]);

  const {
    data: admins = [],
    error: swrError,
    mutate: mutateAdmins,
  } = useSWR<Admin[]>(canManage ? `/api/users?${adminsQs}` : null);
  const { data: orgs = [], mutate: mutateOrgs } = useSWR<Org[]>(
    canManage ? "/api/orgs" : null
  );

  const orgMap = useMemo(
    () => Object.fromEntries(orgs.map((o) => [o.id, `${o.name} (${o.code})`])),
    [orgs]
  );

  async function refresh() {
    await Promise.all([mutateAdmins(), mutateOrgs()]);
  }

  async function registerClient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    setPending(true);
    try {
      await api("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          org: {
            name: form.orgName,
            code: form.orgCode,
            timezone: form.timezone,
            currency: form.currency,
            secondaryCurrency: form.secondaryCurrency || null,
            fxRate: Number(form.fxRate) || 1,
          },
          admin: {
            name: form.adminName,
            email: form.email,
            password: form.password,
          },
        }),
      });
      setForm({
        orgName: "",
        orgCode: "",
        timezone: "UTC",
        currency: "PKR",
        secondaryCurrency: "USD",
        fxRate: "280",
        adminName: "",
        email: "",
        password: "",
      });
      setMsg("Client registered (org + primary orgAdmin)");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function createSecondary(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: secondaryForm.name,
          email: secondaryForm.email,
          password: secondaryForm.password,
          type: "orgAdmin",
          orgIds: secondaryForm.orgIds,
        }),
      });
      setSecondaryForm({ name: "", email: "", password: "", orgIds: [] });
      setMsg("Secondary orgAdmin created");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  function startEdit(a: Admin) {
    setEditing(a);
    setEditForm({
      name: a.name,
      password: "",
      orgIds: a.orgIds || [],
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setPending(true);
    try {
      await api(`/api/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          orgIds: editForm.orgIds,
          ...(editForm.password ? { password: editForm.password } : {}),
        }),
      });
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function promote(id: string) {
    setPending(true);
    try {
      await api(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ transferPrimary: true }),
      });
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(admin: Admin) {
    setPending(true);
    try {
      await api(`/api/users/${admin.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !admin.active }),
      });
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function removeAdmin(admin: Admin) {
    if (!confirm(`Delete ${admin.name}?`)) return;
    setPending(true);
    try {
      await api(`/api/users/${admin.id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  if (!isSuper && !isPrimaryOA) {
    return (
      <EmptyState message="Only superAdmin or primary orgAdmin can manage clients." />
    );
  }

  const displayError =
    error || (swrError instanceof Error ? swrError.message : "");

  return (
    <div>
      <PageHeader
        title="Clients"
        description={
          isSuper
            ? "Register a new client: organization + primary orgAdmin (OA1)."
            : "Add secondary orgAdmins for organizations you manage."
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          className="w-48"
          value={filterOrg}
          onChange={(e) => setFilterOrg(e.target.value)}
        >
          <option value="">All orgs</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-40"
          value={filterPrimary}
          onChange={(e) => setFilterPrimary(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="true">Primary</option>
          <option value="false">Secondary</option>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {isSuper ? (
          <Card>
            <CardHeader>
              <CardTitle>Register client</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={registerClient} className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Organization
                </p>
                <div className="space-y-1">
                  <Label>Org name</Label>
                  <Input
                    value={form.orgName}
                    onChange={(e) =>
                      setForm({ ...form, orgName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Org code</Label>
                  <Input
                    value={form.orgCode}
                    onChange={(e) =>
                      setForm({ ...form, orgCode: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Currency</Label>
                    <Input
                      value={form.currency}
                      onChange={(e) =>
                        setForm({ ...form, currency: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Secondary</Label>
                    <Input
                      value={form.secondaryCurrency}
                      onChange={(e) =>
                        setForm({
                          ...form,
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
                    value={form.fxRate}
                    onChange={(e) =>
                      setForm({ ...form, fxRate: e.target.value })
                    }
                  />
                </div>
                <p className="pt-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Primary orgAdmin
                </p>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={form.adminName}
                    onChange={(e) =>
                      setForm({ ...form, adminName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    required
                    minLength={6}
                  />
                </div>
                {displayError ? (
                  <p className="text-sm text-red-400">{displayError}</p>
                ) : null}
                {msg ? <p className="text-sm text-teal-400">{msg}</p> : null}
                <Button type="submit" className="w-full" loading={pending}>
                  Register client
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Add secondary orgAdmin</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createSecondary} className="space-y-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={secondaryForm.name}
                    onChange={(e) =>
                      setSecondaryForm({
                        ...secondaryForm,
                        name: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={secondaryForm.email}
                    onChange={(e) =>
                      setSecondaryForm({
                        ...secondaryForm,
                        email: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={secondaryForm.password}
                    onChange={(e) =>
                      setSecondaryForm({
                        ...secondaryForm,
                        password: e.target.value,
                      })
                    }
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Assigned orgs</Label>
                  <Select
                    multiple
                    className="h-28"
                    value={secondaryForm.orgIds}
                    onChange={(e) =>
                      setSecondaryForm({
                        ...secondaryForm,
                        orgIds: Array.from(e.target.selectedOptions).map(
                          (o) => o.value
                        ),
                      })
                    }
                    required
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                </div>
                {displayError ? (
                  <p className="text-sm text-red-400">{displayError}</p>
                ) : null}
                {msg ? <p className="text-sm text-teal-400">{msg}</p> : null}
                <Button type="submit" className="w-full" loading={pending}>
                  Create secondary
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Org admins</CardTitle>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? (
              <EmptyState message="No org admins match filters." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Orgs</TH>
                    <TH>Flags</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {admins.map((a) => (
                    <TR key={a.id}>
                      <TD>
                        <div>
                          <p>{a.name}</p>
                          <p className="text-xs text-gray-500">{a.email}</p>
                        </div>
                      </TD>
                      <TD className="text-gray-400">
                        {(a.orgIds || []).map((id) => orgMap[id] || id).join(", ") ||
                          "—"}
                      </TD>
                      <TD className="space-x-1">
                        {a.primary ? (
                          <Badge>primary</Badge>
                        ) : (
                          <Badge variant="muted">secondary</Badge>
                        )}
                        {!a.active ? (
                          <Badge variant="danger">inactive</Badge>
                        ) : null}
                      </TD>
                      <TD>
                        <RowActions
                          actions={[
                            {
                              label: "Edit",
                              variant: "edit",
                              onClick: () => startEdit(a),
                            },
                            ...(!a.primary
                              ? [
                                  {
                                    label: "Make primary",
                                    onClick: () => promote(a.id),
                                    disabled: pending,
                                  },
                                  {
                                    label: a.active
                                      ? "Deactivate"
                                      : "Activate",
                                    onClick: () => toggleActive(a),
                                    disabled: pending,
                                  },
                                  {
                                    label: "Delete",
                                    variant: "delete" as const,
                                    onClick: () => removeAdmin(a),
                                    disabled: pending,
                                  },
                                ]
                              : isSuper
                                ? [
                                    {
                                      label: a.active
                                        ? "Deactivate"
                                        : "Activate",
                                      onClick: () => toggleActive(a),
                                      disabled: pending,
                                    },
                                  ]
                                : []),
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

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit orgAdmin</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveEdit} className="space-y-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Reset password</Label>
                  <Input
                    type="password"
                    value={editForm.password}
                    onChange={(e) =>
                      setEditForm({ ...editForm, password: e.target.value })
                    }
                    placeholder="Leave blank to keep"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Assigned orgs</Label>
                  <Select
                    multiple
                    className="h-28"
                    value={editForm.orgIds}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        orgIds: Array.from(e.target.selectedOptions).map(
                          (o) => o.value
                        ),
                      })
                    }
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={pending}>
                    Save
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
