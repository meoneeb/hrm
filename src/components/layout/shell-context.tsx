"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import useSWR, { mutate as globalMutate } from "swr";
import type { SessionUser } from "@/types";

type Org = {
  id: string;
  name: string;
  code: string;
  currency?: string;
  secondaryCurrency?: string | null;
  fxRate?: number;
};

type Project = { id: string; name: string; code: string };

type ShellContextValue = {
  user: SessionUser;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  orgId: string;
  setOrgId: (id: string) => void;
  projId: string;
  setProjId: (id: string) => void;
  orgs: Org[];
  projects: Project[];
  currentOrg: Org | null;
  refreshOrgs: () => Promise<void>;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgId, setOrgIdState] = useState("");
  const [projId, setProjIdState] = useState("");

  useEffect(() => {
    setCollapsedState(localStorage.getItem("hrm_sidebar") === "1");
    const stored = localStorage.getItem("hrm_orgId");
    const linked =
      user.orgIds?.length
        ? user.orgIds
        : user.orgId
          ? [user.orgId]
          : [];
    const resolved =
      (stored && (user.type === "superAdmin" || linked.includes(stored))
        ? stored
        : null) ||
      linked[0] ||
      user.orgId ||
      "";
    setOrgIdState(resolved);
    if (resolved) localStorage.setItem("hrm_orgId", resolved);
    setProjIdState(localStorage.getItem("hrm_projId") || "");
  }, [user.orgId, user.orgIds, user.type]);

  const { data: orgs = [] } = useSWR<Org[]>("/api/orgs");

  useEffect(() => {
    if (!orgs.length) return;
    setOrgIdState((prev) => {
      if (prev && orgs.some((o) => o.id === prev)) return prev;
      const next = orgs[0]?.id || "";
      if (next) localStorage.setItem("hrm_orgId", next);
      return next;
    });
  }, [orgs]);

  const projectsKey =
    orgId && user.type !== "member" ? `/api/projects?orgId=${orgId}` : null;
  const { data: projects = [] } = useSWR<Project[]>(projectsKey);

  const refreshOrgs = useCallback(async () => {
    await globalMutate("/api/orgs");
  }, []);

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    localStorage.setItem("hrm_sidebar", v ? "1" : "0");
  };

  const setOrgId = (id: string) => {
    setOrgIdState(id);
    localStorage.setItem("hrm_orgId", id);
    setProjIdState("");
    localStorage.removeItem("hrm_projId");
    window.dispatchEvent(new CustomEvent("hrm-org-change", { detail: id }));
  };

  const setProjId = (id: string) => {
    setProjIdState(id);
    if (id) localStorage.setItem("hrm_projId", id);
    else localStorage.removeItem("hrm_projId");
    window.dispatchEvent(new CustomEvent("hrm-proj-change", { detail: id }));
  };

  const currentOrg = useMemo(
    () => orgs.find((o) => o.id === orgId) || null,
    [orgs, orgId]
  );

  const value: ShellContextValue = {
    user,
    collapsed,
    setCollapsed,
    mobileOpen,
    setMobileOpen,
    orgId,
    setOrgId,
    projId,
    setProjId,
    orgs,
    projects,
    currentOrg,
    refreshOrgs,
  };

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}

export function useOrgId() {
  return useShell().orgId;
}
