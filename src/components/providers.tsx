"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { swrFetcher } from "@/lib/api-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig value={{ fetcher: swrFetcher, revalidateOnFocus: true }}>
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
