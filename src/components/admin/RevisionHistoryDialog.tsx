import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History, RotateCcw, Clock, User, Check } from "lucide-react";
import { getRevisions, RevisionRecord } from "@/lib/revisions";
import { format } from "date-fns";

interface RevisionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "product" | "blog_post" | "banner";
  entityId: string | null;
  onRestore: (payload: any) => void;
}

export const RevisionHistoryDialog = ({
  open,
  onOpenChange,
  entityType,
  entityId,
  onRestore,
}: RevisionHistoryDialogProps) => {
  const [revisions, setRevisions] = useState<RevisionRecord[]>([]);
  const [selected, setSelected] = useState<RevisionRecord | null>(null);

  useEffect(() => {
    if (open && entityId) {
      const list = getRevisions(entityType, entityId);
      setRevisions(list);
      setSelected(list[0] || null);
    }
  }, [open, entityType, entityId]);

  if (!entityId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Revision History & Rollback
          </DialogTitle>
          <DialogDescription>
            View past version snapshots and restore any version with 1 click.
          </DialogDescription>
        </DialogHeader>

        {revisions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
            No previous revisions recorded yet. Revisions are created automatically whenever changes are saved.
          </div>
        ) : (
          <div className="grid md:grid-cols-5 gap-4 mt-2">
            {/* Timeline Sidebar */}
            <div className="md:col-span-2 space-y-2 border-r border-border pr-2 max-h-96 overflow-y-auto">
              {revisions.map((rev) => {
                const active = selected?.id === rev.id;
                return (
                  <button
                    key={rev.id}
                    onClick={() => setSelected(rev)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors border ${
                      active ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">v{rev.version}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(rev.created_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                    <div className="truncate text-muted-foreground mt-0.5">{rev.title}</div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-1">
                      <User className="h-3 w-3" /> {rev.author}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Revision Details / Preview */}
            <div className="md:col-span-3 flex flex-col justify-between">
              {selected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Version {selected.version} Preview</span>
                    <Button
                      size="sm"
                      onClick={() => {
                        onRestore(selected.payload);
                        onOpenChange(false);
                      }}
                      className="gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore This Version
                    </Button>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-xs space-y-2 max-h-72 overflow-y-auto font-mono">
                    <div>
                      <span className="text-muted-foreground font-sans">Saved at:</span>{" "}
                      {format(new Date(selected.created_at), "PPPP pp")}
                    </div>
                    <div>
                      <span className="text-muted-foreground font-sans">Title/Name:</span>{" "}
                      <span className="font-sans font-semibold text-foreground">{selected.title}</span>
                    </div>
                    <div className="border-t border-border pt-2">
                      <span className="text-muted-foreground font-sans block mb-1">Payload Summary:</span>
                      <pre className="whitespace-pre-wrap text-[11px] text-foreground/90">
                        {JSON.stringify(selected.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
