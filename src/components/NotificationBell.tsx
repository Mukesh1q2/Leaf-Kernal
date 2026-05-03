import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, X } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

const NotificationBell = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 text-foreground hover:text-secondary transition-colors" aria-label="Notifications">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet</p>
          ) : notifications.map((n) => {
            const inner = (
              <div className={`flex items-start gap-2 p-3 border-b hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-muted/30" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                </div>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(n.id); }} className="text-muted-foreground hover:text-destructive p-1" aria-label="Dismiss">
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
            return n.link ? (
              <Link key={n.id} to={n.link} onClick={() => { markRead(n.id); setOpen(false); }}>{inner}</Link>
            ) : (
              <div key={n.id} onClick={() => markRead(n.id)} role="button">{inner}</div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;