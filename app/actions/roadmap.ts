"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { RoadmapItemStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createRoadmapItemSchema, formDataToObject } from "@/lib/validations";
import { cacheInvalidate } from "@/lib/cache";

export interface RoadmapActionState {
  error?: string;
  success?: string;
}

type SessionWithOrg = { user?: { id: string }; orgId?: string | null };

async function getOrgId(): Promise<string | null> {
  const session = (await auth()) as SessionWithOrg | null;
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });
  return user?.orgId ?? null;
}

export async function createRoadmapItem(
  _prev: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  const parsed = createRoadmapItemSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { title, description, status } = parsed.data;

  await prisma.roadmapItem.create({
    data: { orgId, title, description: description ?? null, status: status as RoadmapItemStatus },
  });

  cacheInvalidate(orgId, "roadmap-items");
  revalidatePath("/roadmap");
  return { success: "Item created." };
}

export async function updateRoadmapItemStatus(
  itemId: string,
  status: RoadmapItemStatus,
): Promise<RoadmapActionState> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  await prisma.roadmapItem.updateMany({
    where: { id: itemId, orgId },
    data: { status },
  });

  cacheInvalidate(orgId, "roadmap-items");
  revalidatePath("/roadmap");
  return { success: "Status updated." };
}

export async function deleteRoadmapItem(
  itemId: string,
): Promise<RoadmapActionState> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  await prisma.roadmapItem.deleteMany({
    where: { id: itemId, orgId },
  });

  cacheInvalidate(orgId, "roadmap-items");
  revalidatePath("/roadmap");
  return { success: "Item deleted." };
}

export async function handleSuggestion(
  suggestionId: string,
  action: "create" | "merge" | "dismiss",
  mergeItemId?: string,
  title?: string,
  description?: string,
): Promise<RoadmapActionState> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  const suggestion = await prisma.roadmapSuggestion.findFirst({
    where: { id: suggestionId, orgId },
  });
  if (!suggestion) return { error: "Suggestion not found" };

  if (action === "create") {
    const itemTitle = title?.trim();
    if (!itemTitle || itemTitle.length < 3) {
      return { error: "Title must be at least 3 characters" };
    }
    const newItem = await prisma.roadmapItem.create({
      data: { orgId, title: itemTitle, description: description?.trim() || null },
    });
    await prisma.roadmapSuggestion.update({
      where: { id: suggestionId },
      data: { status: "CREATED", matchedItemId: newItem.id },
    });
    cacheInvalidate(orgId, "roadmap-items");
  } else if (action === "merge" && mergeItemId) {
    const mergeItem = await prisma.roadmapItem.findFirst({
      where: { id: mergeItemId, orgId },
    });
    if (!mergeItem) return { error: "Item not found" };
    await prisma.roadmapSuggestion.update({
      where: { id: suggestionId },
      data: { status: "MERGED", matchedItemId: mergeItemId },
    });
  } else if (action === "dismiss") {
    await prisma.roadmapSuggestion.update({
      where: { id: suggestionId },
      data: { status: "DISMISSED" },
    });
  }

  revalidatePath("/roadmap/suggestions");
  revalidatePath("/roadmap");
  return { success: "Done." };
}
