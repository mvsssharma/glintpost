"use server";

import { auth } from "@/auth";
import { prisma, getOrgPrisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { feedbackFormSchema, formDataToObject } from "@/lib/validations";
import { logger } from "@/lib/logger";

export interface FeedbackFormState {
  error?: string;
  success?: string;
}

export async function saveFeedbackForm(
  _prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });
  if (!user?.orgId) {
    return { error: "No organization found" };
  }

  const raw = formDataToObject(formData);

  let questions;
  try {
    questions = JSON.parse(raw.questions || "[]");
  } catch {
    return { error: "Invalid questions data" };
  }

  const parsed = feedbackFormSchema.safeParse({
    title: raw.title,
    enabled: raw.enabled === "true",
    questions,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Validate SELECT questions have options
  for (const q of parsed.data.questions) {
    if (q.type === "SELECT" && (!q.options || q.options.length < 2)) {
      return { error: `Select question "${q.text}" must have at least 2 options` };
    }
  }

  const formId = raw.formId; // present when editing, absent when creating
  const db = getOrgPrisma(user.orgId);

  try {
    if (formId) {
      const existing = await db.feedbackForm.findUnique({
        where: { id: formId },
      });
      if (!existing) {
        return { error: "Form not found" };
      }
      await db.feedbackForm.update({
        where: { id: formId },
        data: {
          title: parsed.data.title,
          enabled: parsed.data.enabled ?? false,
          questions: parsed.data.questions,
        },
      });
    } else {
      await db.feedbackForm.create({
        data: {
          orgId: user.orgId,
          title: parsed.data.title,
          enabled: parsed.data.enabled ?? false,
          questions: parsed.data.questions,
        },
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to save feedback form");
    return { error: "Failed to save feedback form" };
  }

  revalidatePath("/feedback");
  return { success: "Feedback form saved." };
}

export async function deleteFeedbackForm(
  formId: string,
): Promise<FeedbackFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });
  if (!user?.orgId) {
    return { error: "No organization found" };
  }

  const db = getOrgPrisma(user.orgId);

  const form = await db.feedbackForm.findUnique({
    where: { id: formId },
  });
  if (!form) {
    return { error: "Form not found" };
  }

  try {
    await db.feedbackForm.delete({ where: { id: formId } });
  } catch (err) {
    logger.error({ err }, "Failed to delete feedback form");
    return { error: "Failed to delete feedback form" };
  }

  revalidatePath("/feedback");
  return { success: "Feedback form deleted." };
}
