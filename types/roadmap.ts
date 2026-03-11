/** Shape returned by the public API for roadmap items */
export interface PublicRoadmapItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  upvotes: number;
  downvotes: number;
  myVote: "UP" | "DOWN" | null;
  createdAt: string;
}

/** Response from the suggestion endpoint */
export interface SuggestionResponse {
  action: "created" | "merged" | "pending";
  suggestion: {
    id: string;
    rawText: string;
    matchedItemId: string | null;
    similarityScore: number | null;
  };
  matchedItem?: { id: string; title: string } | null;
  relatedItems: { itemId: string; title: string; score: number }[];
}
