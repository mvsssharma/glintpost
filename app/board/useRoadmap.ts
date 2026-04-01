import { useState, useEffect, useCallback } from "react";
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
  const [items, setItems] = useState<PublicRoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"votes" | "newest">("votes");

  const fetchItems = useCallback(async () => {
    if (!apiKey) return;
    try {
      const params = new URLSearchParams();
      if (visitorId) params.set("visitorId", visitorId);
      if (filter !== "ALL") params.set("status", filter);
      const res = await fetch(`/api/roadmap/items?${params}`, {
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data: PublicRoadmapItem[] = await res.json();
      setItems(data);
      setError(null);
    } catch {
      setError("Failed to load roadmap items");
    } finally {
      setLoading(false);
    }
  }, [apiKey, visitorId, filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "votes") {
      return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const voteOnItem = useCallback(
    async (itemId: string, voteType: "UP" | "DOWN") => {
      if (!apiKey) return;

      // Lazy visitorId creation on first interaction
      const effectiveVisitorId = ensureVisitorId ? ensureVisitorId() : visitorId;

      // Optimistic update
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          const wasVoted = item.myVote;
          if (wasVoted === voteType) {
            // Toggle off
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
      );

      try {
        const res = await fetch("/api/roadmap/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ itemId, visitorId: effectiveVisitorId, voteType }),
        });
        if (!res.ok) {
          // Revert on error
          await fetchItems();
        }
      } catch {
        await fetchItems();
      }
    },
    [apiKey, visitorId, ensureVisitorId, fetchItems],
  );

  const submitSuggestion = useCallback(
    async (text: string) => {
      if (!apiKey) throw new Error("No API key");
      // Lazy visitorId creation on suggestion submit
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
      // Refresh items after suggestion
      await fetchItems();
      return data;
    },
    [apiKey, visitorId, ensureVisitorId, fetchItems],
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
