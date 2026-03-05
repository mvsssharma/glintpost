"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants";
import { redirect } from "next/navigation";

export interface OnboardingState {
  error?: string;
}

export async function createOrganization(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  // Check if user already has an org
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });
  if (user?.orgId) {
    redirect("/");
  }

  const name = formData.get("name") as string;
  const primaryColor =
    (formData.get("primaryColor") as string) || DEFAULT_PRIMARY_COLOR;
  const localesRaw = formData.get("locales") as string;
  const supportedLocales = localesRaw
    ? localesRaw.split(",").filter(Boolean)
    : ["en"];

  if (!name || name.trim().length < 2) {
    return { error: "Organization name must be at least 2 characters" };
  }

  // Generate a unique slug
  let slug = generateSlug(name);
  const existingSlug = await prisma.organization.findUnique({
    where: { slug },
  });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Create org + settings + link to user in a transaction
  const org = await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name: name.trim(),
        slug,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        onboardingComplete: true,
        settings: {
          create: {
            primaryColor,
            supportedLocales,
            defaultLocale: supportedLocales[0] || "en",
          },
        },
      },
    });

    await tx.user.update({
      where: { id: session.user.id },
      data: { orgId: newOrg.id },
    });

    return newOrg;
  });

  if (!org) {
    return { error: "Failed to create organization" };
  }

  redirect("/");
}

export interface SettingsState {
  error?: string;
  success?: string;
}

/** Update organization and its settings (name, primaryColor, supportedLocales). */
export async function updateOrgSettings(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
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

  const name = (formData.get("name") as string)?.trim();
  const primaryColor =
    (formData.get("primaryColor") as string) || DEFAULT_PRIMARY_COLOR;
  const localesRaw = formData.get("locales") as string;
  const supportedLocales = localesRaw
    ? localesRaw.split(",").filter(Boolean)
    : ["en"];

  if (!name || name.length < 2) {
    return { error: "Organization name must be at least 2 characters" };
  }

  if (supportedLocales.length === 0 || !supportedLocales.includes("en")) {
    return { error: "English must be included in supported languages" };
  }

  try {
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: user.orgId },
        data: { name },
      }),
      prisma.orgSettings.upsert({
        where: { orgId: user.orgId },
        create: {
          orgId: user.orgId,
          primaryColor,
          supportedLocales,
          defaultLocale: supportedLocales[0] || "en",
        },
        update: {
          primaryColor,
          supportedLocales,
          defaultLocale: supportedLocales[0] || "en",
        },
      }),
    ]);
  } catch {
    return { error: "Failed to update settings" };
  }

  return { success: "Settings saved." };
}
