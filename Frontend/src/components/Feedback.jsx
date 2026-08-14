export function EmptyState({ title, description, action }) {
    return (
        <div className="empty-state">
            <h3>{title}</h3>
            <p>{description}</p>
            {action}
        </div>
    )
}

export function SkeletonLines({ count = 3 }) {
    return (
        <div>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="skeleton skeleton-line"
                    style={{ width: i === count - 1 ? "60%" : "100%" }}
                />
            ))}
        </div>
    )
}
