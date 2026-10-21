export interface RevisionRecord {
  id: string;
  entity_type: "product" | "blog_post" | "banner";
  entity_id: string;
  version: number;
  title: string;
  payload: any;
  created_at: string;
  author?: string;
}

const STORAGE_KEY = "leaf_kernel_cms_revisions";

const getAllRevisions = (): RevisionRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveAllRevisions = (list: RevisionRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-200))); // Keep last 200 revisions
  } catch {}
};

export const saveRevision = (
  entityType: "product" | "blog_post" | "banner",
  entityId: string,
  title: string,
  payload: any,
  author = "Admin User"
): RevisionRecord => {
  const all = getAllRevisions();
  const existing = all.filter((r) => r.entity_type === entityType && r.entity_id === entityId);
  const version = existing.length + 1;

  const rev: RevisionRecord = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    entity_type: entityType,
    entity_id: entityId,
    version,
    title,
    payload,
    created_at: new Date().toISOString(),
    author,
  };

  all.unshift(rev);
  saveAllRevisions(all);
  return rev;
};

export const getRevisions = (entityType: string, entityId: string): RevisionRecord[] => {
  const all = getAllRevisions();
  return all
    .filter((r) => r.entity_type === entityType && r.entity_id === entityId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};
