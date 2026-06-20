"use client";

import { usePathname } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";

/**
 * Wraps every /admin/* page in the auth guard — except the login page itself,
 * which must stay reachable while signed out.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return <AdminGuard>{children}</AdminGuard>;
}
