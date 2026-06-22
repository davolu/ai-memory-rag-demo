"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Brain, FileText, MessageSquareText, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Documents", icon: FileText },
  { href: "/dashboard/chat", label: "Chat", icon: MessageSquareText },
];

export function Sidebar({
  user,
}: {
  user: { name?: string | null; email?: string | null };
}) {
  const pathname = usePathname();
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card/60 backdrop-blur">
      <div className="flex items-center gap-2.5 px-5 py-5 font-semibold tracking-tight">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
          <Brain className="h-5 w-5" />
        </span>
        Recall
      </div>

      <div className="px-4 pb-2 pt-1">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Workspace
        </p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  active ? "scale-110" : "group-hover:scale-110"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="mb-1.5 flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-sm font-semibold text-primary-foreground shadow-sm">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user.name || "Signed in"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
