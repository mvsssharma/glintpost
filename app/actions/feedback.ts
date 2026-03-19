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

  try {
    await prisma.feedbackForm.upsert({
      where: { orgId: user.orgId },
      create: {
        orgId: user.orgId,
        title: parsed.data.title,
        enabled: parsed.data.enabled ?? false,
        questions: parsed.data.questions,
      },
      update: {
        title: parsed.data.title,
        enabled: parsed.data.enabled ?? false,
        questions: parsed.data.questions,
      },
    });
  } catch (err) {
    console.error("Failed to save feedback form:", err);
    return { error: "Failed to save feedback form" };
  }

  revalidatePath("/feedback");
  return { success: "Feedback form saved." };
}
