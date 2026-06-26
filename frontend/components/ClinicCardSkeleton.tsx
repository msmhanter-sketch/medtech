/**
 * Skeleton-заглушка карточки во время загрузки.
 */
export default function ClinicCardSkeleton() {
  return (
    <div
      style={{
        background: "var(--bg-white)",
        border: "var(--border-w) solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 24,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div className="skeleton" style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }} />
        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="skeleton" style={{ height: 16, width: "75%" }} />
          <div className="skeleton" style={{ height: 12, width: "45%" }} />
        </div>
      </div>
      <div style={{ height: "var(--border-w)", background: "var(--border)", margin: "18px 0" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="skeleton" style={{ height: 10, width: "30%" }} />
        <div className="skeleton" style={{ height: 32, width: "55%" }} />
        <div className="skeleton" style={{ height: 10, width: "45%" }} />
      </div>
      <div style={{ height: "var(--border-w)", background: "var(--border)", margin: "18px 0" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="skeleton" style={{ height: 12, width: "100%" }} />
        <div className="skeleton" style={{ height: 12, width: "70%" }} />
      </div>
      <div style={{ marginTop: 18 }}>
        <div className="skeleton" style={{ height: 38, width: "100%", borderRadius: "var(--radius-sm)" }} />
      </div>
    </div>
  );
}
