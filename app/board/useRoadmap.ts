import { useState, useCallback } from "react";
import useSWR from "swr";
import { widgetFetcher } from "@/lib/widget-fetcher";
import type { PublicRoadmapItem } from "@/types/roadmap";

interface UseRoadmapReturn {
  items: PublicRoadmapItem[];
  loading: boolean;
  error: string | null;
  filter: string;
  setFilter: (f: string) => void;
  sortBy: "votes" | "newest";
  setSortBy: (s: "votes" | "newest") => void;
  voteOnItem: (itemId: string, voteType: "UP" | "DOWN") => Promise<void>;
  submitSuggestion: (text: string) => Promise<{
    action: string;
    matchedItem?: { id: string; title: string } | null;
  }>;
}

export function useRoadmap(
  apiKey: string | null,
  visitorId: string,
  ensureVisitorId?: () => string,
): UseRoadmapReturn {
  const [filter, setFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"votes" | "newest">("votes");

  const params = new URLSearchParams();
  if (visitorId) params.set("visitorId", visitorId);
  if (filter !== "ALL") params.set("status", filter);

  const { data: itemsData, error: swrError, mutate } = useSWR<PublicRoadmapItem[]>(
    apiKey ? [`/api/roadmap/items?${params.toString()}`, apiKey] : null,
    widgetFetcher
  );

  const items = itemsData || [];
  const loading = !itemsData && !swrError;
  const error = swrError ? "Failed to load roadmap items" : null;

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "votes") {
      return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const voteOnItem = useCallback(
    async (itemId: string, voteType: "UP" | "DOWN") => {
      if (!apiKey) return;

      const effectiveVisitorId = ensureVisitorId ? ensureVisitorId() : visitorId;

      mutate(
        (prev) =>
          (prev || []).map((item) => {
            if (item.id !== itemId) return item;
            const wasVoted = item.myVote;
            if (wasVoted === voteType) {
              return {
                ...item,
                myVote: null,
                upvotes: voteType === "UP" ? item.upvotes - 1 : item.upvotes,
                downvotes: voteType === "DOWN" ? item.downvotes - 1 : item.downvotes,
              };
            }
            return {
              ...item,
              myVote: voteType,
              upvotes:
                voteType === "UP"
                  ? item.upvotes + 1
                  : wasVoted === "UP"
                    ? item.upvotes - 1
                    : item.upvotes,
              downvotes:
                voteType === "DOWN"
                  ? item.downvotes + 1
                  : wasVoted === "DOWN"
                    ? item.downvotes - 1
                    : item.downvotes,
            };
          }),
        false
      );

      try {
        const res = await fetch("/api/roadmap/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ itemId, visitorId: effectiveVisitorId, voteType }),
        });
        if (!res.ok) {
          await mutate();
        }
      } catch {
        await mutate();
      }
    },
    [apiKey, visitorId, ensureVisitorId, mutate],
  );

  const submitSuggestion = useCallback(
    async (text: string) => {
      if (!apiKey) throw new Error("No API key");
      const effectiveVisitorId = ensureVisitorId ? ensureVisitorId() : visitorId;
      const res = await fetch("/api/roadmap/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ text, visitorId: effectiveVisitorId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }
      const data = await res.json();
      await mutate();
      return data;
    },
    [apiKey, visitorId, ensureVisitorId, mutate],
  );

  return {
    items: sortedItems,
    loading,
    error,
    filter,
    setFilter,
    sortBy,
    setSortBy,
    voteOnItem,
    submitSuggestion,
  };
}
