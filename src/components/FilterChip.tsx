"use client"

/** Pill filter matching home primary actions — dark text on light fill when active. */
export default function FilterChip({
  label,
  active,
  onClick,
  ariaLabel,
  role,
}: {
  label: string
  active: boolean
  onClick: () => void
  ariaLabel?: string
  role?: "tab"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-pressed={role ? undefined : active}
      aria-selected={role === "tab" ? active : undefined}
      role={role}
      className="t-button-sm"
      style={{
        color: active ? "var(--background-base)" : "var(--text-emphasis)",
        padding: "8px 16px",
        border: active
          ? "1px solid rgba(255, 255, 255, 0.2)"
          : "1px solid var(--border-default)",
        borderRadius: 999,
        background: active ? "rgba(255, 255, 255, 0.92)" : "var(--tint-base)",
        cursor: "pointer",
        transition:
          "color 0.2s ease, background 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (active) return
        e.currentTarget.style.borderColor = "var(--border-strong)"
        e.currentTarget.style.background = "var(--tint-hover)"
        e.currentTarget.style.color = "var(--text-inverse)"
      }}
      onMouseLeave={(e) => {
        if (active) return
        e.currentTarget.style.borderColor = "var(--border-default)"
        e.currentTarget.style.background = "var(--tint-base)"
        e.currentTarget.style.color = "var(--text-emphasis)"
      }}
    >
      {label}
    </button>
  )
}
