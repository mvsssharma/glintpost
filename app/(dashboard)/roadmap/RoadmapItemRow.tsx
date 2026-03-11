"use client";

import { useTransition } from "react";
import { updateRoadmapItemStatus, deleteRoadmapItem } from "@/app/actions/roadmap";
import { ROADMAP_STATUSES } from "@/lib/constants";
import type { RoadmapItemStatus } from "@prisma/client";
import styles from "./page.module.css";

interface Props {
  item: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    createdAt: string;
    upvotes: number;
    downvotes: number;
  };
  statusColor: string;
  statusLabel: string;
}

export function RoadmapItemRow({ item, statusColor, statusLabel }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: RoadmapItemStatus) => {
    startTransition(async () => {
      await updateRoadmapItemStatus(item.id, newStatus);
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this roadmap item?")) return;
    startTransition(async () => {
      await deleteRoadmapItem(item.id);
    });
  };

  const net = item.upvotes - item.downvotes;

  return (
    <div className={styles.itemCard} style={{ opacity: isPending ? 0.6 : 1 }}>
      <div className={styles.itemInfo}>
        <h3 className={styles.itemTitle}>{item.title}</h3>
        <div className={styles.itemMeta}>
          <span className={styles.statusBadge} style={{ background: statusColor }}>
            {statusLabel}
          </span>
          <span className={styles.votes}>
            {net >= 0 ? "+" : ""}{net} votes ({item.upvotes} up / {item.downvotes} down)
          </span>
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className={styles.itemActions}>
        <select
          className={styles.statusSelect}
          value={item.status}
          onChange={(e) => handleStatusChange(e.target.value as RoadmapItemStatus)}
          disabled={isPending}
        >
          {ROADMAP_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          className={styles.deleteBtn}
          onClick={handleDelete}
          disabled={isPending}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
