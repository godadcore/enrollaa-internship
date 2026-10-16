"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FloatingOverlay } from "@/components/FloatingOverlay";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/state";
import type { UserRole } from "@/types";
import { getStableAvatar } from "@/lib/avatars";
import { CustomSelect } from "@/components/CustomSelect";
import {
  IconDashboard,
  IconCalendar,
  IconClock,
  IconCheckCircle,
  IconTasks,
  IconClipboard,
  IconTrophy,
  IconAnalytics,
  IconUsers,
  IconUser,
  IconSettings,
  IconBell,
  IconMenu,
  IconClose,
  IconLogout,
  IconShield,
  IconMessage,
  IconSend,
} from "@/components/icons";
export { CustomSelect } from "@/components/CustomSelect";
export { CustomDatePicker } from "@/components/CustomDatePicker";

/* ------------------------------------------------------------------ */
/*  Sidebar Navigation Items by Role                                   */
/* ------------------------------------------------------------------ */

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const ADMIN_NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: <IconDashboard size={18} /> },
  { id: "candidates", label: "Candidates", icon: <IconUsers size={18} /> },
  { id: "invitations", label: "Invitations", icon: <IconSend size={18} /> },
  { id: "onboarding", label: "Onboarding", icon: <IconCheckCircle size={18} /> },
  { id: "departments", label: "Departments", icon: <IconAnalytics size={18} /> },
  { id: "staff", label: "Staff", icon: <IconUser size={18} /> },
  { id: "attendance", label: "Attendance", icon: <IconCalendar size={18} /> },
  { id: "tasks", label: "Task Oversight", icon: <IconTasks size={18} /> },
  { id: "reports", label: "Weekly Reports", icon: <IconClipboard size={18} /> },
  { id: "giveaways", label: "Giveaways", icon: <IconTrophy size={18} /> },
  { id: "announcements", label: "Announcements", icon: <IconBell size={18} /> },
  { id: "audit-log", label: "Audit Log", icon: <IconShield size={18} /> },
  { id: "profile", label: "Profile & Settings", icon: <IconSettings size={18} /> },
];

const LEAD_NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: <IconDashboard size={18} /> },
  { id: "onboarding", label: "Onboarding", icon: <IconCheckCircle size={18} /> },
  { id: "team", label: "My Team", icon: <IconUsers size={18} /> },
  { id: "attendance", label: "Attendance", icon: <IconCalendar size={18} /> },
  { id: "tasks", label: "Department Tasks", icon: <IconTasks size={18} /> },
  { id: "reports", label: "Weekly Report", icon: <IconClipboard size={18} /> },
  { id: "giveaways", label: "Giveaways", icon: <IconTrophy size={18} /> },
  { id: "profile", label: "Profile & Settings", icon: <IconSettings size={18} /> },
];

const INTERN_NAV: NavItem[] = [
  { id: "overview", label: "Dashboard", icon: <IconDashboard size={18} /> },
  { id: "onboarding", label: "Onboarding", icon: <IconClipboard size={18} /> },
  { id: "attendance", label: "My Attendance", icon: <IconClock size={18} /> },
  { id: "tasks", label: "My Tasks", icon: <IconTasks size={18} /> },
  { id: "giveaways", label: "Giveaways", icon: <IconTrophy size={18} /> },
  { id: "profile", label: "Profile & Settings", icon: <IconSettings size={18} /> },
];

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case "super_admin":
    case "admin":
      return ADMIN_NAV;
    case "manager":
    case "lead":
      return LEAD_NAV;
    case "intern":
      return INTERN_NAV;
    default:
      return INTERN_NAV;
  }
}

function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "Admin";
    case "manager":
    case "lead":
      return "Department Lead";
    case "intern":
      return "Intern";
  }
}

function getRoleBadgeColor(role: UserRole): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "badge-purple";
    case "manager":
    case "lead":
      return "badge-amber";
    case "intern":
      return "badge-green";
  }
}

/* ------------------------------------------------------------------ */
/*  DashboardShell Component                                           */
/* ------------------------------------------------------------------ */

interface DashboardShellProps {
  children: React.ReactNode;
  activeSection: string;
  onSectionChange: (id: string) => void;
}

export function DashboardShell({
  children,
  activeSection,
  onSectionChange,
}: DashboardShellProps) {
  const { currentUser, logout } = useApp();
  const router = useRouter();
  const [liveNotifications, setLiveNotifications] = useState<{ id: string; title: string; message: string; read: boolean; createdAt: string; link?: string | null }[]>([]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const notificationIdsRef = useRef(new Set<string>());
  const notificationHydratedRef = useRef(false);
  const optimisticReadRef = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserNotificationPermission(window.Notification.permission);
    }
  }, []);

  async function enableBrowserNotifications() {
    if (!(typeof window !== "undefined" && "Notification" in window)) return;
    setBrowserNotificationPermission(await window.Notification.requestPermission());
  }

  useEffect(() => {
    let active = true;
    let request: Promise<void> | null = null;
    let controller: AbortController | null = null;
    const refreshNotifications = async () => {
      if (!active || !currentUser || document.visibilityState !== "visible") return;
      if (request) return request;
      controller = new AbortController();
      request = (async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store", signal: controller?.signal });
        const data = await response.json();
        if (active && response.ok && data.success && Array.isArray(data.notifications)) {
          const nextNotifications = data.notifications as { id: string; title: string; message: string; read: boolean }[];
          if (notificationHydratedRef.current && browserNotificationPermission === "granted") {
            nextNotifications.filter((item) => !item.read && !notificationIdsRef.current.has(item.id)).slice(0, 3).forEach((item) => {
              new window.Notification(item.title, { body: item.message, tag: item.id });
            });
          }
          notificationIdsRef.current = new Set(nextNotifications.map((item) => item.id));
          notificationHydratedRef.current = true;
          setLiveNotifications(data.notifications.map((item: { id: string; read: boolean }) => ({
            ...item,
            read: item.read || optimisticReadRef.current.has(item.id),
          })));
        }
      } catch {
        // Keep the last confirmed notification state during transient outages.
      } finally {
        request = null;
      }
      })();
      return request;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshNotifications();
    };
    void refreshNotifications();
    const timer = window.setInterval(() => void refreshNotifications(), 30_000);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      controller?.abort();
    };
  }, [currentUser, browserNotificationPermission]);

  const notifButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);

  const navItems = getNavItems(currentUser.role);
  const unreadCount = liveNotifications.filter((n) => !n.read).length;
  const userNotifications = liveNotifications;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [activeSection]);

  const userAvatar = getStableAvatar(currentUser);

  return (
    <div className="flex h-[100dvh] min-w-0 overflow-hidden bg-enrollaa-navy safe-area-inline">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — full drawer on mobile, collapsible on desktop */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-40 shrink-0 flex flex-col bg-enrollaa-navy border-r border-white/10
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${isCollapsed ? "lg:w-[76px]" : "lg:w-64"} w-72`}
      >
        {/* Brand Logo Header */}
        <div className={`flex items-center ${isCollapsed ? "lg:justify-center lg:flex-col lg:gap-2 lg:py-3 lg:px-2 justify-between px-5 py-4" : "justify-between px-5 py-4"} border-b border-white/10 min-h-[64px] transition-all`}>
          <a href="/" className="flex items-center gap-2.5">
            <img
              src={isCollapsed ? "/brand/icon-green.svg" : "/brand/Logo1.svg"}
              alt="Enrollaa"
              className={isCollapsed ? "lg:h-8 h-7 w-auto hover:scale-105 transition-transform" : "h-7 w-auto"}
            />
          </a>

          {/* Desktop collapse / expand button */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="hidden lg:flex p-1.5 rounded-sm text-enrollaa-muted-light hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}

          {isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="hidden lg:flex p-1 rounded-sm text-enrollaa-muted-light hover:text-enrollaa-green hover:bg-white/10 transition-colors mt-1 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden p-1.5 rounded-sm text-enrollaa-muted-light hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className={`flex-1 overflow-y-auto scrollbar-none py-4 px-3 space-y-1 ${isCollapsed ? "lg:px-2 lg:space-y-2" : "lg:px-3 lg:space-y-1"}`}>
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  aria-label={item.label}
                  className={`w-full flex items-center cursor-pointer ${
                    isCollapsed ? "lg:justify-center lg:p-3 gap-3 px-3 py-2.5" : "gap-3 px-3 py-2.5"
                  } rounded-sm text-xs font-heading font-semibold transition-all duration-150 text-left ${
                    isActive
                      ? "bg-enrollaa-green text-enrollaa-navy shadow-sm font-bold"
                      : "text-enrollaa-muted-light hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <span className={isActive ? "text-enrollaa-navy" : "text-enrollaa-muted-light group-hover:text-white"}>
                    {item.icon}
                  </span>
                  <span className={isCollapsed ? "lg:hidden" : ""}>{item.label}</span>
                </button>

                {/* Floating Tooltip in collapsed mode (desktop only) */}
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-[#0E1322] border border-white/20 text-white text-xs font-heading font-bold rounded shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-enrollaa-green" />
                      {item.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile Card in Sidebar Footer */}
        <div className={`border-t border-white/10 ${isCollapsed ? "lg:p-2 p-3" : "p-3"} bg-enrollaa-navy transition-all`}>
          {/* Collapsed state — desktop only icon */}
          <div className={isCollapsed ? "hidden lg:flex flex-col items-center gap-2 relative group" : "hidden"}>
            <button
              type="button"
              onClick={() => onSectionChange("profile")}
              className="w-9 h-9 rounded-full overflow-hidden relative border border-white/15 hover:border-enrollaa-green transition-colors cursor-pointer"
              title={`${currentUser.first_name} ${currentUser.surname} — Profile & Settings`}
            >
              <img
                src={userAvatar}
                alt={currentUser.first_name}
                className="w-full h-full object-cover"
              />
            </button>
            {/* Tooltip */}
            <div className="absolute left-full bottom-2 ml-3 px-3 py-2 bg-[#0E1322] border border-white/20 text-white text-xs font-heading rounded shadow-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50">
              <p className="font-bold text-white">{currentUser.first_name} {currentUser.surname}</p>
              <p className="text-[10px] text-enrollaa-muted-light">{getRoleLabel(currentUser.role)}</p>
              <p className="text-[10px] text-enrollaa-green mt-1">Click to edit profile</p>
            </div>
          </div>

          {/* Expanded state — always shown on mobile, shown on desktop when not collapsed */}
          <div className={isCollapsed ? "flex lg:hidden items-center gap-3 px-2 py-1.5" : "flex items-center gap-3 px-2 py-1.5"}>
            <button
              type="button"
              onClick={() => onSectionChange("profile")}
              className="flex items-center gap-3 flex-1 min-w-0 text-left group hover:opacity-80 transition-opacity cursor-pointer"
              title="View Profile & Settings"
            >
              <img
                src={userAvatar}
                alt={currentUser.first_name}
                className="w-8 h-8 rounded-full object-cover border border-white/15 group-hover:border-enrollaa-green transition-colors"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-heading font-semibold text-white truncate group-hover:text-enrollaa-green transition-colors">
                  {currentUser.first_name} {currentUser.surname}
                </p>
                <p className="text-[10px] text-enrollaa-muted-light truncate">
                  {getRoleLabel(currentUser.role)} {currentUser.department ? `• ${currentUser.department}` : ""}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              title="Log out"
              aria-label="Log out"
              className="p-1.5 rounded text-enrollaa-muted-dark hover:text-enrollaa-red hover:bg-white/5 transition-colors cursor-pointer"
            >
              <IconLogout size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        {/* Top Header */}
        <header className="safe-area-top flex min-w-0 items-center justify-between gap-3 px-4 sm:px-5 lg:px-6 py-4 border-b border-white/10 bg-enrollaa-navy min-h-[64px]">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 rounded-sm text-enrollaa-muted-light hover:text-white hover:bg-white/5 transition-colors"
            >
              <IconMenu size={20} />
            </button>
            {/* Mobile hamburger — no logo here, logo lives in the sidebar drawer */}
            <div className="min-w-0">
              <h1 className="font-heading text-sm md:text-base font-bold text-white">
                {navItems.find((n) => n.id === activeSection)?.label || "Dashboard"}
              </h1>
              <p className="text-[10px] md:text-[11px] text-enrollaa-muted-light font-body hidden sm:block">
                {currentUser.role === "super_admin" || currentUser.role === "admin"
                  ? "Enrollaa Admin Oversight"
                  : currentUser.role === "manager" || currentUser.role === "lead"
                  ? `${currentUser.department} Department Lead`
                  : `${currentUser.department} • ${currentUser.role_title}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); setNotifOpen(true); }}
                className="inline-flex max-w-[min(38vw,15rem)] items-center gap-2 rounded-full border border-enrollaa-green/25 bg-enrollaa-green/[0.08] px-2.5 py-1.5 text-left text-[10px] text-enrollaa-green transition-colors hover:bg-enrollaa-green/[0.14] sm:max-w-[15rem] sm:px-3"
                aria-label={`Open latest notification: ${liveNotifications.find((item) => !item.read)?.title || "New notification"}`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-enrollaa-green" aria-hidden="true" />
                <span className="truncate">{liveNotifications.find((item) => !item.read)?.title || "New update"}</span>
              </button>
            )}
            {/* Role Badge */}
            <span className={`${getRoleBadgeColor(currentUser.role)} text-[10px] font-heading font-semibold uppercase tracking-wider px-2.5 py-1 rounded-sm hidden sm:inline-flex`}>
              {getRoleLabel(currentUser.role)}
            </span>

            {/* Notification Popover Button */}
            <div className="relative">
              <button
                ref={notifButtonRef}
                onClick={() => {
                  setUserMenuOpen(false);
                  setNotifOpen((open) => !open);
                }}
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
                className="relative p-2 rounded-sm text-enrollaa-muted-light hover:text-white hover:bg-white/5 transition-colors"
              >
                <IconBell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-enrollaa-green text-enrollaa-navy text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              <FloatingOverlay
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                triggerRef={notifButtonRef}
                align="end"
                matchTriggerWidth={false}
                minWidth={288}
                maxWidth={384}
              >
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#100640]">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-xs font-bold text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-enrollaa-green/15 text-enrollaa-green border border-enrollaa-green/30 text-[10px] px-1.5 py-0.2 rounded-sm font-semibold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {browserNotificationPermission === "default" && (
                      <button type="button" onClick={() => void enableBrowserNotifications()} className="text-[10px] text-enrollaa-green hover:underline">
                        Enable browser alerts
                      </button>
                    )}
                    {unreadCount > 0 && (
                      <button
                        onClick={() => {
                          liveNotifications.forEach((item) => optimisticReadRef.current.add(item.id));
                          void fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).then((response) => {
                            if (!response.ok) {
                              liveNotifications.forEach((item) => optimisticReadRef.current.delete(item.id));
                              return;
                            }
                            setLiveNotifications((current) => current.map((item) => ({ ...item, read: true })));
                          });
                        }}
                        className="text-[10px] text-enrollaa-muted-light hover:text-enrollaa-green transition-colors"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="border-b border-white/10 px-4 py-2 text-[10px] leading-relaxed text-enrollaa-muted-light" role="status" aria-live="polite">
                    {browserNotificationPermission === "default" && "Browser alerts are off. Enable them to receive alerts for new updates while this app is open."}
                    {browserNotificationPermission === "granted" && "Browser alerts are enabled for new unread updates."}
                    {browserNotificationPermission === "denied" && "Browser alerts are blocked. Enable notifications for this site in your browser settings."}
                    {browserNotificationPermission === "unsupported" && "Browser alerts are unavailable here. In-app notifications remain available."}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                    {userNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-enrollaa-muted-light text-xs">
                        No notifications yet.
                      </div>
                    ) : (
                      userNotifications.slice(0, 15).map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => {
                            optimisticReadRef.current.add(notif.id);
                            void fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notif.id }) }).then((response) => {
                              if (!response.ok) optimisticReadRef.current.delete(notif.id);
                            });
                            setLiveNotifications((current) => current.map((item) => (item.id === notif.id ? { ...item, read: true } : item)));
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors ${
                            !notif.read ? "bg-enrollaa-green/[0.04]" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                notif.read ? "bg-white/15" : "bg-enrollaa-green"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-heading font-semibold text-white truncate">
                                {notif.title}
                              </p>
                              <p className="text-[11px] text-enrollaa-muted-light mt-0.5 line-clamp-2 leading-relaxed">
                                {notif.message}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
              </FloatingOverlay>
            </div>

            {/* User Account Popover */}
            <div className="relative">
              <button
                ref={userMenuButtonRef}
                onClick={() => {
                  setNotifOpen(false);
                  setUserMenuOpen((open) => !open);
                }}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="flex items-center gap-2 p-1 rounded-sm hover:bg-white/5 transition-colors"
              >
                <img
                  src={userAvatar}
                  alt={currentUser.first_name}
                  className="w-7 h-7 rounded-full object-cover border border-white/20"
                />
              </button>

              <FloatingOverlay
                open={userMenuOpen}
                onClose={() => setUserMenuOpen(false)}
                triggerRef={userMenuButtonRef}
                align="end"
                matchTriggerWidth={false}
                minWidth={224}
                maxWidth={256}
                className="overflow-hidden py-1.5"
                role="menu"
              >
                  <div className="px-4 py-2.5 border-b border-white/10">
                    <p className="text-xs font-heading font-bold text-white truncate">
                      {currentUser.first_name} {currentUser.surname}
                    </p>
                    <p className="text-[10px] text-enrollaa-muted-light truncate mt-0.5">
                      {currentUser.email}
                    </p>
                    <span className="inline-block mt-1.5 text-[9px] uppercase tracking-wider font-heading font-semibold px-2 py-0.5 rounded-sm bg-white/10 text-white">
                      {getRoleLabel(currentUser.role)}
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        onSectionChange("profile");
                        setUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-enrollaa-muted-light hover:text-white hover:bg-white/5 flex items-center gap-2"
                    >
                      <IconSettings size={14} />
                      <span>Profile &amp; Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        void handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-enrollaa-red hover:bg-enrollaa-red/10 flex items-center gap-2"
                    >
                      <IconLogout size={14} />
                      <span>Log out</span>
                    </button>
                  </div>
              </FloatingOverlay>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatCard Component                                                */
/* ------------------------------------------------------------------ */

export function StatCard({
  label,
  value,
  icon,
  trend,
  color = "green",
  onClick,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: "green" | "amber" | "red" | "purple";
  onClick?: () => void;
}) {
  const colorMap = {
    green: "text-enrollaa-green bg-enrollaa-green/10 border-enrollaa-green/20",
    amber: "text-enrollaa-amber bg-enrollaa-amber/10 border-enrollaa-amber/20",
    red: "text-enrollaa-red bg-enrollaa-red/10 border-enrollaa-red/20",
    purple: "text-enrollaa-purple bg-enrollaa-purple/10 border-enrollaa-purple/20",
  };

  const CardWrapper = onClick ? "button" : "div";

  return (
    <CardWrapper
      onClick={onClick}
      className={`glass-card p-4 md:p-5 text-left w-full transition-all duration-200 ${
        onClick ? "hover:border-white/20 active:scale-[0.99] cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-heading font-medium text-enrollaa-muted-light">{label}</p>
          <p className="text-xl md:text-2xl font-heading font-bold text-white tracking-tight">{value}</p>
          {trend && (
            <p className="text-[11px] text-enrollaa-muted-light font-body mt-0.5">{trend}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-sm border ${colorMap[color]} shrink-0`}>
          {icon}
        </div>
      </div>
    </CardWrapper>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal Component                                                   */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sizeMap = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  const modal = (
    <div
      className="modal-overlay animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative bg-enrollaa-navy border border-white/10 rounded-md shadow-modal-glow ${sizeMap[size]} w-full max-h-[min(40rem,calc(100dvh-2rem))] flex flex-col overflow-hidden animate-fade-in-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/10 bg-enrollaa-navy shrink-0 z-10">
          <h2 className="font-heading text-sm md:text-base font-bold text-white truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded text-enrollaa-muted-light hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <IconClose size={18} />
          </button>
        </div>
        <div className="p-5 md:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );

  // Escape dashboard scroll/stacking contexts. A modal must cover the browser
  // viewport, not merely the scrolling dashboard panel that opened it.
  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}

/* ------------------------------------------------------------------ */
/*  StatusBadge Component                                             */
/* ------------------------------------------------------------------ */

export function StatusBadge({ status }: { status: string }) {
  const badgeMap: Record<string, string> = {
    selected: "badge-muted",
    invitation_sent: "badge-amber",
    expired: "badge-red",
    revoked: "badge-red",
    registration_started: "badge-amber",
    submitted: "badge-purple",
    approved: "badge-green",
    account_activated: "badge-green",
    withdrawn: "badge-red",
    on_time: "badge-green",
    late: "badge-amber",
    excused: "badge-purple",
    absent: "badge-red",
    assigned: "badge-muted",
    in_progress: "badge-amber",
    revision_requested: "badge-amber",
    rejected: "badge-red",
    cancelled: "badge-red",
    draft: "badge-muted",
    scheduled: "badge-amber",
    running: "badge-purple",
    completed: "badge-green",
    reviewed: "badge-green",
    changes_requested: "badge-amber",
    pending: "badge-amber",
    processing: "badge-purple",
    paid: "badge-green",
    failed: "badge-red",
    not_sent: "badge-muted",
    sent: "badge-amber",
    not_started: "badge-muted",
    stopped: "badge-red",
    not_created: "badge-muted",
    activation_pending: "badge-amber",
  };

  const labels: Record<string, string> = {
    not_sent: "Not sent",
    sent: "Sent",
    not_started: "Not started",
    stopped: "Stopped",
    not_created: "Not created",
    activation_pending: "Activation pending",
    onboarding_started: "In progress",
    onboarding_submitted: "Submitted",
    invitation_sent: "Sent",
    account_activated: "Active",
  };

  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`${badgeMap[status] || "badge-muted"} max-w-full whitespace-normal text-center leading-snug`}>
      {labels[status] || label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  EmptyState Component                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in border border-dashed border-white/10 rounded-sm">
      <div className="p-3.5 rounded-md bg-white/[0.03] text-enrollaa-muted-light mb-3">{icon}</div>
      <h3 className="font-heading text-sm md:text-base font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-enrollaa-muted-light max-w-sm mb-4 leading-relaxed">{description}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DataTable Component                                               */
/* ------------------------------------------------------------------ */

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  const labelledRows = React.Children.map(children, (row) => {
    if (!React.isValidElement<React.HTMLAttributes<HTMLTableRowElement>>(row)) return row;
    const cells = React.Children.map(row.props.children, (cell, index) => {
      if (!React.isValidElement<React.TdHTMLAttributes<HTMLTableCellElement>>(cell)) return cell;
      return React.cloneElement(cell, { "aria-label": headers[index] || "Detail" });
    });
    return React.cloneElement(row, undefined, cells);
  });

  return (
    <div className="glass-card min-w-0 overflow-hidden border border-white/10">
      <div className="min-w-0">
        <table className="responsive-table w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/10">
              {headers.map((h) => (
                <th key={h} className="table-header py-3 px-4 text-xs font-heading font-semibold text-enrollaa-muted-light uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">{labelledRows}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ConfirmDialog Component                                           */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  confirmText,
  variant = "primary",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  variant?: "primary" | "danger";
}) {
  const finalLabel = confirmText || confirmLabel;
  if (!open) return null;
  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="bg-[#0E1322] border border-white/15 rounded-md shadow-2xl max-w-sm w-full mx-4 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 md:p-6 space-y-3">
          <h3 className="font-heading text-base font-bold text-white">{title}</h3>
          <p className="text-xs text-enrollaa-muted-light leading-relaxed">{message}</p>
          <div className="flex items-center gap-2 justify-end pt-3">
            <button onClick={onClose} className="btn-ghost text-xs py-2 px-3">
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`text-xs py-2 px-4 rounded-sm font-heading font-bold ${
                variant === "danger"
                  ? "bg-enrollaa-red text-white hover:bg-enrollaa-red/80"
                  : "bg-enrollaa-green text-enrollaa-navy hover:bg-enrollaa-green-hover"
              }`}
            >
              {finalLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TabBar Component                                                  */
/* ------------------------------------------------------------------ */

export function TabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <>
      <div className="sm:hidden w-full">
        <CustomSelect
          value={activeTab}
          onChange={onChange}
          options={tabs.map((tab) => ({
            value: tab.id,
            label: tab.count === undefined ? tab.label : `${tab.label} (${tab.count})`,
          }))}
          aria-label="Select view"
        />
      </div>
      <div className="hidden sm:flex flex-wrap items-center gap-1.5 p-1 bg-[#090C15] border border-white/10 rounded-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex min-h-9 items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-heading font-semibold whitespace-normal text-left transition-colors duration-150 ${
              activeTab === tab.id
                ? "bg-enrollaa-green text-enrollaa-navy shadow-sm font-bold"
                : "text-enrollaa-muted-light hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && <span className="px-1.5 py-0.2 rounded-pill text-[10px] bg-white/10 text-inherit">{tab.count}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Toast Notification Component                                      */
/* ------------------------------------------------------------------ */

export function Toast({
  message,
  type = "success",
  visible,
  onClose,
}: {
  message: string;
  type?: "success" | "error" | "info";
  visible: boolean;
  onClose?: () => void;
}) {
  if (!visible || !message) return null;

  const colorStyles = {
    success: "bg-[#0E1B15] border-enrollaa-green/40 text-enrollaa-green",
    error: "bg-[#201015] border-enrollaa-red/40 text-enrollaa-red",
    info: "bg-[#141228] border-enrollaa-purple/40 text-enrollaa-purple",
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-[60] animate-fade-in-up sm:left-auto sm:w-full sm:max-w-sm">
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-sm border shadow-2xl ${colorStyles[type]}`}
      >
        <span className="text-xs font-heading font-semibold text-white">{message}</span>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Dismiss toast"
            className="p-1 hover:opacity-75 transition-opacity"
          >
            <IconClose size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
