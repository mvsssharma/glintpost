import type { Prisma } from "@prisma/client";

/**
 * Seeds one sample entry per content section for a newly created org so
 * dashboards are never blank on first login. Nothing here is publicly visible:
 * the post and announcement are DRAFT, and the roadmap item is ARCHIVED
 * (the public board excludes archived items).
 */
export async function seedSampleContent(
  tx: Prisma.TransactionClient,
  orgId: string
): Promise<void> {
  await tx.post.create({
    data: {
      orgId,
      status: "DRAFT",
      translations: {
        create: {
          orgId,
          locale: "en",
          title: "👋 Your first changelog post (sample)",
          content:
            "<p>This is a sample draft — only you can see it. Edit it, or delete it and create your own.</p>" +
            "<p>A few things you can do with changelog posts:</p>" +
            "<ul>" +
            "<li>Write with the rich text editor and paste images straight in</li>" +
            "<li>Keep posts as drafts until you are ready to publish</li>" +
            "<li>Target posts to specific users with datalayer rules</li>" +
            "<li>Migrating from another tool? Use <strong>Import</strong> above to bring your history over with original dates</li>" +
            "</ul>",
        },
      },
    },
  });

  await tx.roadmapItem.create({
    data: {
      orgId,
      title: "Your first feature request (sample)",
      description:
        "This sample is archived, so it never appears on your public board. " +
        "Roadmap items move through Under Review → Planned → In Progress → Completed, " +
        "and visitors can vote and suggest ideas from your embedded board. " +
        "Create your own items, or use Import to carry over items and vote counts from your old tool.",
      status: "ARCHIVED",
    },
  });

  const now = new Date();
  await tx.announcement.create({
    data: {
      orgId,
      title: "Your first announcement (sample)",
      content:
        "This is a sample draft — it will not show to visitors until you publish it. " +
        "Announcements appear on your site as a full-screen overlay or a top banner, " +
        "can be scheduled with start/end dates, and support a call-to-action button.",
      displayType: "OVERLAY",
      status: "DRAFT",
      startDate: now,
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}
