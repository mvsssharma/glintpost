/** Display totals: visitor-tracked votes plus migration carry-over (not per-visitor). */
export function roadmapVoteTotals(
  importedUpvotes: number,
  importedDownvotes: number,
  visitorUpvotes: number,
  visitorDownvotes: number,
): { upvotes: number; downvotes: number } {
  return {
    upvotes: visitorUpvotes + importedUpvotes,
    downvotes: visitorDownvotes + importedDownvotes,
  };
}
