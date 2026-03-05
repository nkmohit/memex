import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export interface AppSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface AppSelectProps {
  options: AppSelectOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  size?: "md" | "sm";
}

function nextEnabledIndex(options: AppSelectOption[], start: number, step: 1 | -1): number {
  if (options.length === 0) return -1;

  let idx = start;
  for (let i = 0; i < options.length; i += 1) {
    idx = (idx + step + options.length) % options.length;
    if (!options[idx]?.disabled) return idx;
  }

  return -1;
}

export default function AppSelect({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  disabled = false,
  size = "md",
}: AppSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [menuAlign, setMenuAlign] = useState<"left" | "right">("left");

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  );
  const [activeIndex, setActiveIndex] = useState(Math.max(selectedIndex, 0));

  const selectedOption = options[selectedIndex] ?? options[0] ?? { label: "", value: "" };

  useEffect(() => {
    if (selectedIndex >= 0) setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const menuRect = menuRef.current?.getBoundingClientRect();
    if (!menuRect) return;
    if (menuRect.right > window.innerWidth - 8) {
      setMenuAlign("right");
      return;
    }
    if (menuRect.left < 8) {
      setMenuAlign("left");
      return;
    }
    setMenuAlign("left");
  }, [open, options.length]);

  function openMenu() {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : nextEnabledIndex(options, -1, 1));
  }

  function closeMenu() {
    setOpen(false);
  }

  function commitSelection(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    closeMenu();
    buttonRef.current?.focus();
  }

  function moveActive(step: 1 | -1) {
    const start = activeIndex >= 0 ? activeIndex : selectedIndex >= 0 ? selectedIndex : -1;
    const idx = nextEnabledIndex(options, start, step);
    if (idx >= 0) setActiveIndex(idx);
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!open) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        openMenu();
        moveActive(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        openMenu();
        moveActive(-1);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === "Tab") {
      closeMenu();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      const idx = nextEnabledIndex(options, -1, 1);
      if (idx >= 0) setActiveIndex(idx);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const idx = nextEnabledIndex(options, 0, -1);
      if (idx >= 0) setActiveIndex(idx);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commitSelection(activeIndex >= 0 ? activeIndex : selectedIndex);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`app-select-root${size === "sm" ? " app-select-root--sm" : ""}${className ? ` ${className}` : ""}`}
      data-open={open ? "true" : "false"}
      data-align={menuAlign}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`app-select-control${size === "sm" ? " app-select-control--sm" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onButtonKeyDown}
      >
        <span className="app-select-value">{selectedOption.label}</span>
        <ChevronDown size={14} className="app-select-chevron" aria-hidden />
      </button>

      {open && (
        <ul
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="app-select-menu"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`app-select-option${isSelected ? " selected" : ""}${isActive ? " active" : ""}${option.disabled ? " disabled" : ""}`}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitSelection(index)}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
