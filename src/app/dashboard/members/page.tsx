"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { useOrgId, useShell } from "@/components/layout/shell-context";
import { PageHeader, EmptyState } from "@/components/ui/misc";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { InitialsAvatar, RowActions } from "@/components/ui/row-actions";

type Member = {
  id: string;
  name: string;
  email: string;
  type: string;
  primary?: boolean;
  scope: string;
  code?: string;
  designation?: string;
  active: boolean;
  projIds?: string[];
  salary?: { basic: number; allowances: number; deductions: number };
  credits?: { typeId: string; balance: number }[];
};

type Project = { id: string; name: string };
type Shift = { id: string; name: string; startTime?: string; endTime?: string };

const ORG_USER_TYPES = new Set(["orgAdmin", "projectManager", "member"]);

const NONE = "__none__";

function roleRank(u: Member) {
  if (u.type === "orgAdmin" && u.primary) return 0;
  if (u.type === "orgAdmin") return 1;
  if (u.type === "projectManager") return 2;
  if (u.type === "member") return 3;
  return 4;
}

function roleLabel(u: Member) {
  if (u.type === "orgAdmin") {
    return u.primary ? "orgAdmin · primary" : "orgAdmin · secondary";
  }
  return u.type;
}

export default function MembersPage() {
  const { data: session } = useSession();
  const orgId = useOrgId();
  const { currentOrg } = useShell();
  const canAddOrgAdmin =
    session?.user?.type === "superAdmin" ||
    (session?.user?.type === "orgAdmin" && session.user.primary);

  const usersKey = orgId ? `/api/users?orgId=${orgId}` : null;
  const projectsKey = orgId ? `/api/projects?orgId=${orgId}` : null;
  const shiftsKey = orgId ? `/api/shifts?orgId=${orgId}` : null;

  const {
    data: users = [],
    error: swrError,
    mutate: mutateUsers,
  } = useSWR<Member[]>(usersKey);
  const { data: projects = [], mutate: mutateProjects } =
    useSWR<Project[]>(projectsKey);
  const { data: shifts = [], mutate: mutateShifts } =
    useSWR<Shift[]>(shiftsKey);

  const members = useMemo(() => {
    return users
      .filter((u) => ORG_USER_TYPES.has(u.type))
      .slice()
      .sort((a, b) => {
        const rank = roleRank(a) - roleRank(b);
        if (rank !== 0) return rank;
        return a.name.localeCompare(b.name);
      });
  }, [users]);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    type: "member",
    scope: "org",
    projIds: [] as string[],
    code: "",
    designation: "",
    shiftId: "",
    basic: 50000,
    allowances: 5000,
    deductions: 1000,
  });

  const isOrgAdminType = form.type === "orgAdmin";
  const isStaffType =
    form.type === "member" || form.type === "projectManager";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.designation || "").toLowerCase().includes(q) ||
        roleLabel(m).toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q)
    );
  }, [members, search]);

  async function ensureDefaultShift(id: string) {
    if (shifts.length > 0) return shifts[0].id;
    const res = await api<Shift>("/api/shifts", {
      method: "POST",
      body: JSON.stringify({
        orgId: id,
        name: "General",
        startTime: "09:00",
        endTime: "18:00",
        graceMinutes: 15,
      }),
    });
    await mutateShifts();
    return res.data.id;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return setError("Select an org first");
    setError("");
    setPending(true);
    try {
      if (form.type === "orgAdmin") {
        await api("/api/users", {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            type: "orgAdmin",
            orgId,
            orgIds: [orgId],
          }),
        });
      } else {
        const shiftId = form.shiftId || (await ensureDefaultShift(orgId));
        await api("/api/users", {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            type: form.type,
            orgId,
            scope: form.scope,
            projIds: form.scope === "projects" ? form.projIds : [],
            code: form.code,
            designation: form.designation,
            shiftId,
            salary: {
              basic: form.basic,
              allowances: form.allowances,
              deductions: form.deductions,
            },
          }),
        });
      }
      setForm({
        ...form,
        name: "",
        email: "",
        password: "",
        code: "",
        type: "member",
      });
      setShowForm(false);
      await mutateUsers();
      await mutateProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function remove(m: Member) {
    if (!confirm(`Delete ${m.name}?`)) return;
    setPending(true);
    try {
      await api(`/api/users/${m.id}`, { method: "DELETE" });
      await mutateUsers();
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(m: Member) {
    setPending(true);
    try {
      await api(`/api/users/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !m.active }),
      });
      await mutateUsers();
    } finally {
      setPending(false);
    }
  }

  const projMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const displayError =
    error || (swrError instanceof Error ? swrError.message : "");

  return (
    <div>
      <PageHeader
        title="Members"
        description={
          orgId
            ? `${filtered.length} of ${members.length} users`
            : "Select an organization"
        }
        actions={
          orgId ? (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Add user
            </Button>
          ) : null
        }
      />
      {!orgId ? (
        <EmptyState message="Select an organization from the top bar." />
      ) : (
        <>
          <div className="mb-4">
            <Input
              className="max-w-md"
              placeholder="Search name, email, role, designation"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Card>
            <CardContent className="pt-6">
              {filtered.length === 0 ? (
                <EmptyState message="No users in this org." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>User</TH>
                      <TH>Role</TH>
                      <TH>Designation</TH>
                      <TH>Projects</TH>
                      <TH>Base salary</TH>
                      <TH>Leave</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {filtered.map((m) => {
                      const isPrimaryAdmin = m.type === "orgAdmin" && m.primary;
                      return (
                      <TR key={m.id}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <InitialsAvatar name={m.name} />
                            <div>
                              <p className="font-medium text-white">{m.name}</p>
                              <p className="text-xs text-gray-500">{m.email}</p>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <Badge
                            variant={
                              m.type === "orgAdmin"
                                ? m.primary
                                  ? "success"
                                  : "default"
                                : m.type === "projectManager"
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {roleLabel(m)}
                          </Badge>
                        </TD>
                        <TD>
                          <span className="text-amber-400">
                            {m.designation || "—"}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            {m.type === "orgAdmin" || m.scope === "org" ? (
                              <Badge variant="muted">Org-wide</Badge>
                            ) : (
                              (m.projIds || []).map((id) => (
                                <Badge key={id} variant="muted">
                                  {projMap[id] || id.slice(-4)}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TD>
                        <TD>
                          <Money
                            amount={m.salary?.basic || 0}
                            currency={currentOrg?.currency || "PKR"}
                            secondaryCurrency={currentOrg?.secondaryCurrency}
                            fxRate={currentOrg?.fxRate || 1}
                          />
                        </TD>
                        <TD className="text-gray-400">
                          {(m.credits || []).reduce((s, c) => s + c.balance, 0)}{" "}
                          days
                        </TD>
                        <TD>
                          <Badge variant={m.active ? "success" : "danger"}>
                            {m.active ? "Active" : "Inactive"}
                          </Badge>
                        </TD>
                        <TD>
                          <RowActions
                            actions={[
                              {
                                label: "Edit",
                                variant: "edit",
                                onClick: () => {
                                  window.location.href = `/dashboard/members/${m.id}`;
                                },
                              },
                              {
                                label: m.active ? "Deactivate" : "Activate",
                                onClick: () => toggleActive(m),
                                disabled: pending || isPrimaryAdmin,
                              },
                              {
                                label: "Delete",
                                variant: "delete",
                                onClick: () => remove(m),
                                disabled: pending || isPrimaryAdmin,
                              },
                            ]}
                          />
                        </TD>
                      </TR>
                    );
                    })}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Primary orgAdmin is created via Clients. Here you can add a
              secondary orgAdmin, PM, or member for this org.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                autoComplete="new-password"
                placeholder="Min. 6 characters"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(type) => setForm({ ...form, type })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">member</SelectItem>
                    <SelectItem value="projectManager">
                      projectManager
                    </SelectItem>
                    {canAddOrgAdmin ? (
                      <SelectItem value="orgAdmin">
                        orgAdmin (secondary)
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              {isStaffType ? (
                <div className="space-y-1">
                  <Label>Scope</Label>
                  <Select
                    value={form.scope}
                    onValueChange={(scope) => setForm({ ...form, scope })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="org">Whole org</SelectItem>
                      <SelectItem value="projects">
                        Specific projects
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Access</Label>
                  <Input value="Org-wide (secondary)" disabled />
                </div>
              )}
            </div>
            {isStaffType && form.scope === "projects" ? (
              <div className="space-y-1">
                <Label>Projects</Label>
                <MultiSelect
                  options={projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  value={form.projIds}
                  onChange={(projIds) => setForm({ ...form, projIds })}
                  placeholder="Select projects"
                />
              </div>
            ) : null}
            {isStaffType ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input
                      value={form.code}
                      onChange={(e) =>
                        setForm({ ...form, code: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Designation</Label>
                    <Input
                      value={form.designation}
                      onChange={(e) =>
                        setForm({ ...form, designation: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Shift</Label>
                  <Select
                    value={form.shiftId || NONE}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        shiftId: v === NONE ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Org default / auto General" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        Org default / auto General
                      </SelectItem>
                      {shifts.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.startTime}–{s.endTime})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label>Basic</Label>
                    <Input
                      type="number"
                      value={form.basic}
                      onChange={(e) =>
                        setForm({ ...form, basic: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Allow</Label>
                    <Input
                      type="number"
                      value={form.allowances}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          allowances: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Deduct</Label>
                    <Input
                      type="number"
                      value={form.deductions}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          deductions: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </>
            ) : null}
            {isOrgAdminType ? (
              <p className="text-xs text-gray-400">
                Creates a secondary orgAdmin linked to the current
                organization. Primary orgAdmins are registered under
                Clients.
              </p>
            ) : null}
            {displayError ? (
              <p className="text-sm text-red-400">{displayError}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
