"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { useOrgId } from "@/components/layout/shell-context";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/ui/row-actions";

type Project = {
  id: string;
  name: string;
  code: string;
  status: string;
  managerIds: string[];
};

export default function ProjectsPage() {
  const orgId = useOrgId();
  const key = orgId ? `/api/projects?orgId=${orgId}` : null;
  const { data: projects = [], error: swrError, mutate } = useSWR<Project[]>(key);
  const [form, setForm] = useState({ name: "", code: "" });
  const [editing, setEditing] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return setError("Select an org first");
    setError("");
    setPending(true);
    try {
      if (editing) {
        await api(`/api/projects/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name }),
        });
        setEditing(null);
      } else {
        await api("/api/projects", {
          method: "POST",
          body: JSON.stringify({ ...form, orgId }),
        });
      }
      setForm({ name: "", code: "" });
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  async function remove(p: Project) {
    if (!confirm(`Delete project ${p.name}?`)) return;
    setPending(true);
    try {
      await api(`/api/projects/${p.id}`, { method: "DELETE" });
      await mutate();
    } finally {
      setPending(false);
    }
  }

  const displayError = error || (swrError instanceof Error ? swrError.message : "");

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Projects sit under an organization."
      />
      {!orgId ? (
        <EmptyState message="Select an organization from the top bar." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{editing ? "Edit project" : "New project"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreate} className="space-y-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                {!editing ? (
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input
                      value={form.code}
                      onChange={(e) =>
                        setForm({ ...form, code: e.target.value })
                      }
                      required
                    />
                  </div>
                ) : null}
                {displayError ? (
                  <p className="text-sm text-red-400">{displayError}</p>
                ) : null}
                <div className="flex gap-2">
                  {editing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1"
                      disabled={pending}
                      onClick={() => {
                        setEditing(null);
                        setForm({ name: "", code: "" });
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  <Button type="submit" className="flex-1" loading={pending}>
                    {editing ? "Save" : "Create project"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Projects in org</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <EmptyState message="No projects yet." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Code</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {projects.map((p) => (
                      <TR key={p.id}>
                        <TD>{p.name}</TD>
                        <TD className="text-gray-400">{p.code}</TD>
                        <TD>
                          <Badge
                            variant={
                              p.status === "active" ? "success" : "muted"
                            }
                          >
                            {p.status}
                          </Badge>
                        </TD>
                        <TD>
                          <RowActions
                            actions={[
                              {
                                label: "Edit",
                                variant: "edit",
                                onClick: () => {
                                  setEditing(p);
                                  setForm({ name: p.name, code: p.code });
                                },
                              },
                              {
                                label: "Delete",
                                variant: "delete",
                                onClick: () => remove(p),
                                disabled: pending,
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
      )}
    </div>
  );
}
