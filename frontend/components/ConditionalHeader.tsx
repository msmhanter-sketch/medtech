"use client";

import { usePathname } from "next/navigation";
import NavHeader from "@/components/NavHeader";

export default function ConditionalHeader() {
  const path = usePathname();
  if (path === "/") return null;
  return <NavHeader />;
}
