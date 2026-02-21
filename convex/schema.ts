import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    contextWindowSettings: defineTable({
        userId: v.string(),
        xPosition: v.number(),
        yPosition: v.number(),
        isMinimized: v.boolean(),
        isVisible: v.boolean(),
        autoShowEnabled: v.boolean(),
        transparencyLevel: v.number(),
        lastShownContent: v.optional(v.any()),
        updatedAt: v.optional(v.string()),
    }).index("by_userId", ["userId"]),
});
