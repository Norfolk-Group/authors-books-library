/**
 * duplicateDetection.router.ts
 * tRPC procedures for the Duplicate Detection System.
 */
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  runDuplicateScan,
  flagBookDuplicate,
  resolveBookDuplicate,
  getPendingBookDuplicates,
} from "../services/duplicateDetection.service";

export const duplicateDetectionRouter = router({
  scan: adminProcedure.mutation(async () => runDuplicateScan()),
  getPending: adminProcedure.query(async () => getPendingBookDuplicates()),
  resolveBook: adminProcedure
    .input(z.object({ candidateId: z.number().int().positive(), action: z.enum(["keep", "discard", "replace"]) }))
    .mutation(async ({ input }) => { await resolveBookDuplicate(input.candidateId, input.action); return { success: true }; }),
  flagBook: adminProcedure
    .input(z.object({ candidateId: z.number().int().positive(), canonicalId: z.number().int().positive(), method: z.enum(["isbn", "fuzzy_title"]) }))
    .mutation(async ({ input }) => { await flagBookDuplicate(input.candidateId, input.canonicalId, input.method); return { success: true }; }),
});
