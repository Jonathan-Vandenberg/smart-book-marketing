export type DraftStatus = "draft" | "approved" | "scheduled" | "published" | "rejected";

export type Platform = {
  id: number;
  slug: string;
  name: string;
  handle: string | null;
  tier: number;
  automationLevel: string;
  category: string;
  apiConnected: boolean;
  profileUrl: string | null;
  notes: string | null;
  createdAt: string;
};

export type ContentDraft = {
  id: number;
  platformId: number;
  platformSlug: string;
  platformName: string;
  pillar: string | null;
  title: string | null;
  body: string;
  status: DraftStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  agentSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardStats = {
  platformCount: number;
  draftCount: number;
  pendingReview: number;
  scheduledCount: number;
  publishedCount: number;
};
