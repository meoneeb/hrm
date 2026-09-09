"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { swrFetcher } from "@/lib/api-client";
import { Toaster } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig value={{ fetcher: swrFetcher, revalidateOnFocus: true }}>
        {children}
        <Toaster />
      </SWRConfig>
    </SessionProvider>
  );
}
