"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function ConditionalFooter() {
  const path = usePathname();
  if (path === "/") return null;
  return <Footer variant="full" />;
}
