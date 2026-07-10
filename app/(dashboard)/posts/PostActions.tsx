"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PostActions({ postId }: { postId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete post.");
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="list-row-actions">
      <button
        className="btn-secondary"
        onClick={() => router.push(`/posts/${postId}/edit`)}
      >
        Edit
      </button>
      <button
        className="btn-secondary btn-danger"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}
