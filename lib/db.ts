import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 2,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

// Tenant-scoped models that require orgId filtering
const TENANT_SCOPED_MODELS = new Set([
  "Organization",
  "OrgSettings",
  "Post",
  "PostTranslation",
  "EngagementEvent",
]);

/**
 * Returns a Prisma client extension that auto-injects orgId into
 * all queries on tenant-scoped models.
 */
export function getOrgPrisma(orgId: string) {
  return prisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_SCOPED_MODELS.has(model)) return query(args);

        const a = args as Record<string, unknown>;

        // For Organization model, scope by id instead of orgId
        if (model === "Organization") {
          if (
            operation === "findMany" ||
            operation === "findFirst" ||
            operation === "count" ||
            operation === "deleteMany" ||
            operation === "updateMany"
          ) {
            a.where = { ...(a.where as object), id: orgId };
          }
          return query(args);
        }

        // For other tenant-scoped models, inject orgId into reads
        if (
          operation === "findMany" ||
          operation === "findFirst" ||
          operation === "count" ||
          operation === "deleteMany" ||
          operation === "updateMany"
        ) {
          a.where = { ...(a.where as object), orgId };
        } else if (operation === "create") {
          a.data = { ...(a.data as object), orgId };
        } else if (operation === "createMany") {
          const data = a.data;
          if (Array.isArray(data)) {
            a.data = data.map((d: Record<string, unknown>) => ({
              ...d,
              orgId,
            }));
          } else {
            a.data = { ...(data as object), orgId };
          }
        }

        return query(args);
      },
    },
  });
}
