"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { IconCalendar, IconClock, IconClose } from "@/components/icons";
import { formatInWAT } from "@/lib/date-utils";
import { FloatingOverlay } from "@/components/FloatingOverlay";

export interface CustomDatePickerProps {
  value: string; // ISO string or YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  includeTime?: boolean;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  className?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CustomDatePicker({
  value,
  onChange,
  label,
  placeholder = "Select date...",
  includeTime = false,
  required = false,
  disabled = false,
  minDate,
  className = "",
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Parse initial date
  const parsedDate = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  // View state: current year and month in view
  const [viewYear, setViewYear] = useState(() => (parsedDate ? parsedDate.getFullYear() : 2026));
  const [viewMonth, setViewMonth] = useState(() => (parsedDate ? parsedDate.getMonth() : 9)); // 0-indexed, default Oct (9)

  // Selected state
  const [selectedDay, setSelectedDay] = useState<number | null>(() => (parsedDate ? parsedDate.getDate() : null));
  const [selectedHour, setSelectedHour] = useState<number>(() => {
    if (!parsedDate) return 19; // Default 7 PM WAT
    return parsedDate.getHours();
  });
  const [selectedMinute, setSelectedMinute] = useState<number>(() => {
    if (!parsedDate) return 0;
    return parsedDate.getMinutes();
  });

  // Sync internal view when value changes externally
  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth());
      setSelectedDay(parsedDate.getDate());
      setSelectedHour(parsedDate.getHours());
      setSelectedMinute(parsedDate.getMinutes());
    }
  }, [parsedDate]);


  // Generate calendar days for the current viewMonth & viewYear
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateKey: string;
    }> = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateKey: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      days.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        dateKey: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    // Next month padding to fill complete grid of 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateKey: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const emitDate = (year: number, month: number, day: number, hour: number, minute: number) => {
    const d = new Date(Date.UTC(year, month, day, hour, minute, 0));
    onChange(d.toISOString());
  };

  const handleSelectDay = (dayObj: (typeof calendarDays)[0]) => {
    setViewYear(dayObj.year);
    setViewMonth(dayObj.month);
    setSelectedDay(dayObj.day);
    emitDate(dayObj.year, dayObj.month, dayObj.day, selectedHour, selectedMinute);
    if (!includeTime) {
      setIsOpen(false);
    }
  };

  const setPreset = (daysOffset: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    setSelectedDay(target.getDate());
    emitDate(target.getFullYear(), target.getMonth(), target.getDate(), selectedHour, selectedMinute);
    if (!includeTime) setIsOpen(false);
  };

  // Check if today
  const today = new Date();
  const isToday = (year: number, month: number, day: number) => {
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  // Check if selected
  const isSelected = (year: number, month: number, day: number) => {
    if (!parsedDate) return false;
    return (
      parsedDate.getFullYear() === year &&
      parsedDate.getMonth() === month &&
      parsedDate.getDate() === day
    );
  };

  // Formatted display value
  const displayValue = useMemo(() => {
    if (!parsedDate) return "";
    return formatInWAT(parsedDate.toISOString(), {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: includeTime ? "2-digit" : undefined,
      minute: includeTime ? "2-digit" : undefined,
    });
  }, [parsedDate, includeTime]);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-heading font-semibold text-white mb-1.5 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-enrollaa-green">*</span>}
          </span>
          <span className="text-[10px] text-enrollaa-muted-dark font-mono">
            West Africa Time (WAT)
          </span>
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3.5 py-2.5 rounded-sm bg-[#100640] border transition-all duration-150 flex items-center justify-between gap-2.5 text-left text-xs ${
          disabled
            ? "opacity-50 cursor-not-allowed border-white/5"
            : isOpen
            ? "border-enrollaa-green ring-1 ring-enrollaa-green/30 bg-enrollaa-navy-light"
            : "border-white/15 hover:border-enrollaa-green/40 hover:bg-enrollaa-navy-light"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <IconCalendar
            size={16}
            className={displayValue ? "text-enrollaa-green" : "text-enrollaa-muted-light"}
          />
          <span className={`truncate font-mono ${displayValue ? "text-white" : "text-enrollaa-muted-light"}`}>
            {displayValue || placeholder}
          </span>
        </div>

        {displayValue ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setSelectedDay(null);
            }}
            className="p-1 text-enrollaa-muted-dark hover:text-white transition-colors"
            title="Clear date"
          >
            <IconClose size={12} />
          </button>
        ) : (
          <svg
            className="w-4 h-4 text-enrollaa-muted-light shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      <FloatingOverlay
        open={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        matchTriggerWidth={false}
        minWidth={288}
        maxWidth={360}
        className="p-4"
      >
          {/* Quick Presets Bar */}
          <div className="flex items-center gap-1.5 pb-3 border-b border-white/10 mb-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setPreset(0)}
              className="text-[10px] font-heading font-semibold px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-enrollaa-muted-light hover:text-white transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPreset(1)}
              className="text-[10px] font-heading font-semibold px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-enrollaa-muted-light hover:text-white transition-colors"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => setPreset(7)}
              className="text-[10px] font-heading font-semibold px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-enrollaa-muted-light hover:text-white transition-colors"
            >
              In 1 Week
            </button>
          </div>

          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-sm text-white">
                {MONTH_NAMES[viewMonth]}
              </span>
              <span className="font-heading font-semibold text-sm text-enrollaa-green font-mono">
                {viewYear}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="p-1.5 rounded text-enrollaa-muted-light hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="p-1.5 rounded text-enrollaa-muted-light hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Day of Week Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAY_NAMES.map((name) => (
              <span
                key={name}
                className="text-[10px] font-heading font-semibold text-enrollaa-muted-dark py-1"
              >
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((d) => {
              const selected = isSelected(d.year, d.month, d.day);
              const currentDay = isToday(d.year, d.month, d.day);

              return (
                <button
                  type="button"
                  key={d.dateKey}
                  onClick={() => handleSelectDay(d)}
                  className={`h-8 w-8 mx-auto rounded-sm flex items-center justify-center text-xs font-mono transition-all duration-100 ${
                    selected
                      ? "bg-enrollaa-green text-[#0F0040] font-bold shadow-md scale-105"
                      : currentDay
                      ? "border border-enrollaa-green text-enrollaa-green font-semibold hover:bg-enrollaa-green/10"
                      : d.isCurrentMonth
                      ? "text-white hover:bg-white/10"
                      : "text-white/20 hover:text-white/40 hover:bg-white/5"
                  }`}
                >
                  {d.day}
                </button>
              );
            })}
          </div>

          {/* Time Picker (Optional) */}
          {includeTime && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-enrollaa-muted-light font-heading flex items-center gap-1.5">
                  <IconClock size={13} className="text-enrollaa-green" />
                  Time (WAT)
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  {/* Hours */}
                  <select
                    value={selectedHour}
                    onChange={(e) => {
                      const h = parseInt(e.target.value, 10);
                      setSelectedHour(h);
                      if (selectedDay) {
                        emitDate(viewYear, viewMonth, selectedDay, h, selectedMinute);
                      }
                    }}
                    className="bg-[#100640] border border-white/15 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-enrollaa-green"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Footer Close / Done */}
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-enrollaa-muted-dark font-mono">
              West Africa Time
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn-primary text-xs py-1 px-3"
            >
              Done
            </button>
          </div>
      </FloatingOverlay>
    </div>
  );
}

export default CustomDatePicker;
