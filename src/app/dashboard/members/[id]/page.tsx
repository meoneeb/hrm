"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { useOrgId, useShell } from "@/components/layout/shell-context";
import { PageHeader, EmptyState, Select } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { InitialsAvatar } from "@/components/ui/row-actions";
import { formatShiftTime } from "@/lib/datetime";

type Member = {
  id: string;
  name: string;
  email: string;
  type: string;
  scope: string;
  orgId?: string;
  code?: string;
  designation?: string;
  shiftId?: string | null;
  salary?: { basic: number; allowances: number; deductions: number };
  credits?: { typeId: string; balance: number }[];
};

type LeaveType = { id: string; name: string; paid: boolean };
type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

export default function MemberProfilePage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const orgId = useOrgId();
  const { currentOrg } = useShell();
  const canEditCredits =
    session?.user?.type === "superAdmin" ||
    session?.user?.type === "orgAdmin";

  const {
    data: member,
    error: swrError,
    mutate,
  } = useSWR<Member>(params.id ? `/api/users/${params.id}` : null);

  const creditOrgId = member?.orgId || orgId;
  const { data: leaveTypes = [] } = useSWR<LeaveType[]>(
    creditOrgId ? `/api/leave-types?orgId=${creditOrgId}` : null
  );
  const { data: shifts = [] } = useSWR<Shift[]>(
    creditOrgId ? `/api/shifts?orgId=${creditOrgId}` : null
  );

  const [salary, setSalary] = useState({
    basic: 0,
    allowances: 0,
    deductions: 0,
  });
  const [profile, setProfile] = useState({
    name: "",
    designation: "",
    code: "",
    shiftId: "",
  });
  const [creditBalances, setCreditBalances] = useState<Record<string, string>>(
    {}
  );
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!member) return;
    setSalary(member.salary || { basic: 0, allowances: 0, deductions: 0 });
    setProfile({
      name: member.name,
      designation: member.designation || "",
      code: member.code || "",
      shiftId: member.shiftId || "",
    });
  }, [member]);

  useEffect(() => {
    if (!member || !leaveTypes.length) return;
    const map: Record<string, string> = {};
    for (const t of leaveTypes) {
      const found = (member.credits || []).find((c) => c.typeId === t.id);
      map[t.id] = String(found?.balance ?? 0);
    }
    setCreditBalances(map);
  }, [member, leaveTypes]);

  async function save() {
    setMsg("");
    setError("");
    setPending(true);
    try {
      await api<Member>(`/api/users/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: profile.name,
          designation: profile.designation,
          code: profile.code,
          shiftId: profile.shiftId || null,
          salary,
          ...(password ? { password } : {}),
        }),
      });
      setPassword("");
      setMsg("Saved");
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function saveCredits() {
    setMsg("");
    setError("");
    setPending(true);
    try {
      const credits = leaveTypes.map((t) => ({
        typeId: t.id,
        balance: Number(creditBalances[t.id] ?? 0),
      }));
      await api(`/api/users/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ credits }),
      });
      setMsg("Leave credits updated");
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  const loadError =
    error || (swrError instanceof Error ? swrError.message : "");

  if (loadError && !member) return <EmptyState message={loadError} />;
  if (!member) return <p className="text-gray-400">Loading…</p>;

  return (
    <div>
      <PageHeader
        title={member.name}
        description={`${member.email} · ${member.type} · scope: ${member.scope}`}
      />
      <div className="mb-6 flex items-center gap-4">
        <InitialsAvatar name={member.name} className="h-14 w-14 text-base" />
        <Money
          amount={salary.basic}
          currency={currentOrg?.currency || "PKR"}
          secondaryCurrency={currentOrg?.secondaryCurrency}
          fxRate={currentOrg?.fxRate || 1}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input
                value={profile.code}
                onChange={(e) =>
                  setProfile({ ...profile, code: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Designation</Label>
              <Input
                value={profile.designation}
                onChange={(e) =>
                  setProfile({ ...profile, designation: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Shift</Label>
              <Select
                value={profile.shiftId}
                onChange={(e) =>
                  setProfile({ ...profile, shiftId: e.target.value })
                }
              >
                <option value="">Org default</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatShiftTime(s.startTime)} –{" "}
                    {formatShiftTime(s.endTime)})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reset password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                placeholder="Leave blank to keep current"
              />
            </div>
            <Button onClick={save} loading={pending}>
              Save profile
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Salary (base currency)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Basic</Label>
              <Input
                type="number"
                value={salary.basic}
                onChange={(e) =>
                  setSalary({ ...salary, basic: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Allowances</Label>
              <Input
                type="number"
                value={salary.allowances}
                onChange={(e) =>
                  setSalary({ ...salary, allowances: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Deductions</Label>
              <Input
                type="number"
                value={salary.deductions}
                onChange={(e) =>
                  setSalary({ ...salary, deductions: Number(e.target.value) })
                }
              />
            </div>
            {msg ? <p className="text-sm text-teal-400">{msg}</p> : null}
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button onClick={save} loading={pending}>
              Save salary
            </Button>
          </CardContent>
        </Card>

        {canEditCredits ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Leave credits</CardTitle>
              <p className="text-sm text-gray-400">
                Negative balances are allowed and deduct from payroll.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {leaveTypes.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No leave types for this org yet.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {leaveTypes.map((t) => (
                    <div key={t.id} className="space-y-1">
                      <Label>
                        {t.name}
                        {!t.paid ? " (unpaid)" : ""}
                      </Label>
                      <Input
                        type="number"
                        step="1"
                        value={creditBalances[t.id] ?? "0"}
                        onChange={(e) =>
                          setCreditBalances({
                            ...creditBalances,
                            [t.id]: e.target.value,
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button
                onClick={saveCredits}
                loading={pending}
                disabled={!leaveTypes.length}
              >
                Update leave credits
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
