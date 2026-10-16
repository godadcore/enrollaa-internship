"use client";

import React, { useState, useRef, useEffect } from "react";
import { IconSearch, IconClose } from "@/components/icons";
import { FloatingOverlay } from "@/components/FloatingOverlay";

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  label,
  required = false,
  searchable = false,
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to SelectOption objects
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      opt.label.toLowerCase().includes(query) ||
      (opt.subtitle && opt.subtitle.toLowerCase().includes(query)) ||
      opt.value.toLowerCase().includes(query)
    );
  });

  const closeMenu = () => {
    setIsOpen(false);
    setSearchQuery("");
  };

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    } else if (e.key === "Escape") {
      closeMenu();
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    closeMenu();
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-heading font-semibold text-white mb-1.5 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-enrollaa-green">*</span>}
          </span>
          {value && !disabled && (
            <span className="text-[10px] text-enrollaa-muted-dark font-mono">
              Selected
            </span>
          )}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`w-full min-h-[42px] px-3.5 py-2.5 rounded-sm bg-[#100640] border transition-all duration-150 flex items-center justify-between gap-2.5 text-left text-xs ${
          disabled
            ? "opacity-50 cursor-not-allowed border-white/5"
            : isOpen
            ? "border-enrollaa-green ring-1 ring-enrollaa-green/30 bg-enrollaa-navy-light"
            : "border-white/15 hover:border-enrollaa-green/40 hover:bg-enrollaa-navy-light"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0 text-enrollaa-green">{selectedOption.icon}</span>
          )}
          <div className="min-w-0 flex-1">
            {selectedOption ? (
              <div>
                <p className="text-white font-medium truncate">{selectedOption.label}</p>
                {selectedOption.subtitle && (
                  <p className="text-[10px] text-enrollaa-muted-light truncate">
                    {selectedOption.subtitle}
                  </p>
                )}
              </div>
            ) : (
              <span className="text-enrollaa-muted-light">{placeholder}</span>
            )}
          </div>
        </div>

        {/* Chevron Icon */}
        <svg
          className={`w-4 h-4 text-enrollaa-muted-light shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-enrollaa-green" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <FloatingOverlay
        open={isOpen}
        onClose={closeMenu}
        triggerRef={triggerRef}
        matchTriggerWidth
        role="listbox"
        className="overflow-hidden max-h-72 flex flex-col"
      >
          {searchable && (
            <div className="p-2 border-b border-white/10 bg-[#100640] sticky top-0 z-10">
              <div className="relative flex items-center">
                <IconSearch
                  size={14}
                  className="absolute left-3 text-enrollaa-muted-light pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search options..."
                  className="w-full bg-[#100640] border border-white/10 rounded-sm pl-8 pr-7 py-1.5 text-xs text-white placeholder-enrollaa-muted-light focus:outline-none focus:border-enrollaa-green"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 text-enrollaa-muted-light hover:text-white"
                  >
                    <IconClose size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto flex-1 divide-y divide-white/5 py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-enrollaa-muted-light">
                No matching options found.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 text-xs transition-colors duration-100 ${
                      isSelected
                        ? "bg-enrollaa-green/15 text-white font-semibold"
                        : "text-enrollaa-muted-light hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate ${isSelected ? "text-enrollaa-green font-bold" : "text-white"}`}>
                          {opt.label}
                        </p>
                        {opt.subtitle && (
                          <p className="text-[10px] text-enrollaa-muted-dark truncate mt-0.5">
                            {opt.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Green checkmark for selected option */}
                    {isSelected && (
                      <svg
                        className="w-4 h-4 text-enrollaa-green shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
      </FloatingOverlay>
    </div>
  );
}

export default CustomSelect;
