"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { feedbackFormSchema, formDataToObject } from "@/lib/validations";

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

  try {
    if (formId) {
      // Update existing form — verify it belongs to this org
      const existing = await prisma.feedbackForm.findUnique({
        where: { id: formId },
      });
      if (!existing || existing.orgId !== user.orgId) {
        return { error: "Form not found" };
      }
      await prisma.feedbackForm.update({
        where: { id: formId },
        data: {
          title: parsed.data.title,
          enabled: parsed.data.enabled ?? false,
          questions: parsed.data.questions,
        },
      });
    } else {
      // Create new form
      await prisma.feedbackForm.create({
        data: {
          orgId: user.orgId,
          title: parsed.data.title,
          enabled: parsed.data.enabled ?? false,
          questions: parsed.data.questions,
        },
      });
    }
  } catch (err) {
    console.error("Failed to save feedback form:", err);
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

  const form = await prisma.feedbackForm.findUnique({
    where: { id: formId },
  });
  if (!form || form.orgId !== user.orgId) {
    return { error: "Form not found" };
  }

  try {
    await prisma.feedbackForm.delete({ where: { id: formId } });
  } catch (err) {
    console.error("Failed to delete feedback form:", err);
    return { error: "Failed to delete feedback form" };
  }

  revalidatePath("/feedback");
  return { success: "Feedback form deleted." };
}
