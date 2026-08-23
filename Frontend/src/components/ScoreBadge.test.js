import { describe, it, expect } from "vitest"
import { scoreTone } from "./ScoreBadge"

// Boundary values matter more than mid-range ones here — an off-by-one
// would silently miscolor a score right at the 50/75 cutoffs, which is
// exactly where a candidate is most likely to be looking closely.
describe("scoreTone", () => {
    it("returns danger below 50", () => {
        expect(scoreTone(0)).toBe("danger")
        expect(scoreTone(49)).toBe("danger")
    })

    it("returns warning from 50 up to (not including) 75", () => {
        expect(scoreTone(50)).toBe("warning")
        expect(scoreTone(74)).toBe("warning")
    })

    it("returns success at 75 and above", () => {
        expect(scoreTone(75)).toBe("success")
        expect(scoreTone(100)).toBe("success")
    })
})
