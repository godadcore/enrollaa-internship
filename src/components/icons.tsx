"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  Calendar03Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  Task01Icon,
  ClipboardIcon,
  TrophyIcon,
  Award01Icon,
  Analytics01Icon,
  UserGroupIcon,
  UserCircleIcon,
  Settings02Icon,
  Notification02Icon,
  Search01Icon,
  Menu01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  Logout01Icon,
  ArrowRight02Icon,
  ArrowLeft02Icon,
  ArrowUpRight01Icon,
  LinkSquare01Icon,
  SentIcon,
  PencilEdit02Icon,
  Add01Icon,
  Comment01Icon,
  FilterIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  EyeIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function IconDashboard({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={DashboardSquare01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconCalendar({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Calendar03Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconClock({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Clock01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconCheckCircle({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={CheckmarkCircle02Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconTasks({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Task01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconClipboard({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={ClipboardIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconTrophy({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={TrophyIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconAward({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Award01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconAnalytics({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Analytics01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconTrendingUp({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={ArrowUpRight01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconUsers({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={UserGroupIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconUser({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={UserCircleIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconSettings({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Settings02Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconBell({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Notification02Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconSearch({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Search01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconMenu({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Menu01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconClose({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Cancel01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconXCircle({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={CancelCircleIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconLogout({ size = 18, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Logout01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconArrowRight({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={ArrowRight02Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconArrowLeft({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={ArrowLeft02Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconExternalLink({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={LinkSquare01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconSend({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={SentIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconEdit({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={PencilEdit02Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconPlus({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Add01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconMessage({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Comment01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconFilter({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={FilterIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconShield({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={ShieldCheckIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconAlertCircle({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={AlertCircleIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconEye({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={EyeIcon} size={size} strokeWidth={strokeWidth} className={className} />;
}

export function IconEyeOff({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function IconUpload({ size = 16, className = "", strokeWidth = 1.6 }: IconProps) {
  return <HugeiconsIcon icon={Upload01Icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

