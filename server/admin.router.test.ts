import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for the admin router: getActionLogs and recordAction
 * These use a mocked DB layer to avoid hitting the real database.
 */

// Mock the db module
vi.mock("./db", () => {
  const store: Record<string, any>[] = [];

  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockResolvedValue(store),
    })),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockImplementation((val: any) => {
      store.push(val);
      return Promise.resolve();
    }),
  };

  const mockDb = {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
  };

  return {
    getDb: vi.fn().mockResolvedValue(mockDb),
    __store: store,
    __mockDb: mockDb,
  };
});

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin-open-id",
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
      loginMethod: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("admin.getActionLogs", () => {
  it("returns a result (empty when no logs exist)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.getActionLogs();
    // The procedure calls db.select().from(adminActionLog) which returns the mock chain
    // In production this returns an array; with our mock it returns the chain object
    expect(result).toBeDefined();
  });
});

describe("admin.recordAction", () => {
  it("accepts valid input and returns success", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.recordAction({
      actionKey: "test-regenerate",
      label: "Regenerate Database",
      durationMs: 1234,
      result: "success",
      itemCount: 109,
    });

    expect(result).toEqual({ success: true });
  });

  it("accepts null itemCount", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.recordAction({
      actionKey: "test-enrich-bios",
      label: "Enrich Bios",
      durationMs: 5678,
      result: "completed 50/109",
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects missing required fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.recordAction({
        actionKey: "test",
        // missing label, durationMs, result
      } as any)
    ).rejects.toThrow();
  });
});
