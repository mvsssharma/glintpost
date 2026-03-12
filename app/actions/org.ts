"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants";
import { encrypt } from "@/lib/crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createOrgSchema, updateOrgSettingsSchema, formDataToObject } from "@/lib/validations";

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

  const parsed = createOrgSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const name = parsed.data.name;
  const primaryColor = parsed.data.primaryColor || DEFAULT_PRIMARY_COLOR;
  const supportedLocales = parsed.data.locales
    ? parsed.data.locales.split(",").filter(Boolean)
    : ["en"];

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

  const parsed = updateOrgSettingsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const name = parsed.data.name;
  const primaryColor = parsed.data.primaryColor || DEFAULT_PRIMARY_COLOR;
  const widgetTheme = parsed.data.widgetTheme === "dark" ? "dark" : "light";
  const supportedLocales = parsed.data.locales
    ? parsed.data.locales.split(",").filter(Boolean)
    : ["en"];

  const aiProvider = parsed.data.aiProvider ?? null;
  const aiModel = parsed.data.aiModel ?? null;
  const aiApiKeyRaw = parsed.data.aiApiKey || "";

  // Validate allowed domain — must be a valid origin, no regex/wildcards
  const allowedDomainRaw = (parsed.data.allowedDomain || "").trim().replace(/\/+$/, "");
  let allowedDomain: string | null = null;
  if (allowedDomainRaw) {
    // Reject regex special characters and wildcards
    if (/[*+?{}()|[\]\\^$]/.test(allowedDomainRaw)) {
      return { error: "Allowed domain must be an exact origin (e.g. https://example.com). Wildcards and patterns are not supported." };
    }
    try {
      const url = new URL(allowedDomainRaw);
      // Must be http or https, must have a hostname, no path beyond /
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
        return { error: "Allowed domain must start with https:// or http://" };
      }
      allowedDomain = url.origin; // Normalizes to protocol + host + port
    } catch {
      return { error: "Allowed domain must be a valid URL (e.g. https://example.com)" };
    }
  }

  if (supportedLocales.length === 0 || !supportedLocales.includes("en")) {
    return { error: "English must be included in supported languages" };
  }

  // Encrypt AI API key if provided
  let aiApiKey: string | undefined;
  if (aiApiKeyRaw) {
    aiApiKey = await encrypt(aiApiKeyRaw);
  }

  const settingsData = {
    primaryColor,
    widgetTheme,
    supportedLocales,
    defaultLocale: supportedLocales[0] || "en",
    allowedDomain,
    ...(aiProvider !== null && { aiProvider }),
    ...(aiModel !== null && { aiModel }),
    ...(aiApiKey !== undefined && { aiApiKey }),
    // Clear AI fields if provider is removed
    ...(!aiProvider && { aiProvider: null, aiModel: null, aiApiKey: null }),
  };

  try {
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: user.orgId },
        data: { name },
      }),
      prisma.orgSettings.upsert({
        where: { orgId: user.orgId },
        create: { orgId: user.orgId, ...settingsData },
        update: settingsData,
      }),
    ]);
  } catch (err) {
    console.error("Failed to update settings:", err);
    return { error: "Failed to update settings" };
  }

  revalidatePath("/settings");
  return { success: "Settings saved." };
}
