"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { RoadmapItemStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

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

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const status = ((formData.get("status") as string) || "UNDER_REVIEW") as RoadmapItemStatus;

  if (!title || title.length < 3) {
    return { error: "Title must be at least 3 characters" };
  }

  await prisma.roadmapItem.create({
    data: { orgId, title, description, status },
  });

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

  revalidatePath("/roadmap");
  return { success: "Item deleted." };
}

export async function handleSuggestion(
  suggestionId: string,
  action: "create" | "merge" | "dismiss",
  mergeItemId?: string,
): Promise<RoadmapActionState> {
  const orgId = await getOrgId();
  if (!orgId) return { error: "Not authenticated" };

  const suggestion = await prisma.roadmapSuggestion.findFirst({
    where: { id: suggestionId, orgId },
  });
  if (!suggestion) return { error: "Suggestion not found" };

  if (action === "create") {
    const newItem = await prisma.roadmapItem.create({
      data: { orgId, title: suggestion.rawText },
    });
    await prisma.roadmapSuggestion.update({
      where: { id: suggestionId },
      data: { status: "CREATED", matchedItemId: newItem.id },
    });
  } else if (action === "merge" && mergeItemId) {
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
