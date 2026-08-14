/**
 * Same score, same color, everywhere it appears — dashboard list, report
 * header, practice grading. A consistent color language (green = strong,
 * amber = borderline, red = weak) is what makes scores scannable at a
 * glance instead of just numbers you have to read carefully.
 */
export function scoreTone(score) {
    if (score >= 75) return "success"
    if (score >= 50) return "warning"
    return "danger"
}

export default function ScoreBadge({ score }) {
    return <span className={`badge badge-${scoreTone(score)}`}>{score}%</span>
}
