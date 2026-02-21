import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get settings for a user
export const get = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("contextWindowSettings")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();
    },
});

// Create settings for a new user
export const create = mutation({
    args: {
        userId: v.string(),
        xPosition: v.number(),
        yPosition: v.number(),
        isMinimized: v.boolean(),
        isVisible: v.boolean(),
        autoShowEnabled: v.boolean(),
        transparencyLevel: v.number(),
        lastShownContent: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("contextWindowSettings", {
            userId: args.userId,
            xPosition: args.xPosition,
            yPosition: args.yPosition,
            isMinimized: args.isMinimized,
            isVisible: args.isVisible,
            autoShowEnabled: args.autoShowEnabled,
            transparencyLevel: args.transparencyLevel,
            lastShownContent: args.lastShownContent,
            updatedAt: new Date().toISOString(),
        });
        return await ctx.db.get(id);
    },
});

// Update settings for a user
export const update = mutation({
    args: {
        userId: v.string(),
        xPosition: v.optional(v.number()),
        yPosition: v.optional(v.number()),
        isMinimized: v.optional(v.boolean()),
        isVisible: v.optional(v.boolean()),
        autoShowEnabled: v.optional(v.boolean()),
        transparencyLevel: v.optional(v.number()),
        lastShownContent: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("contextWindowSettings")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (!existing) return null;

        const { userId, ...updates } = args;
        // Filter out undefined values
        const cleanUpdates: Record<string, any> = { updatedAt: new Date().toISOString() };
        if (updates.xPosition !== undefined) cleanUpdates.xPosition = updates.xPosition;
        if (updates.yPosition !== undefined) cleanUpdates.yPosition = updates.yPosition;
        if (updates.isMinimized !== undefined) cleanUpdates.isMinimized = updates.isMinimized;
        if (updates.isVisible !== undefined) cleanUpdates.isVisible = updates.isVisible;
        if (updates.autoShowEnabled !== undefined) cleanUpdates.autoShowEnabled = updates.autoShowEnabled;
        if (updates.transparencyLevel !== undefined) cleanUpdates.transparencyLevel = updates.transparencyLevel;
        if (updates.lastShownContent !== undefined) cleanUpdates.lastShownContent = updates.lastShownContent;

        await ctx.db.patch(existing._id, cleanUpdates);
        return true;
    },
});
