"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuBell,
  LuCheckCheck,
  LuClipboardList,
  LuFileText,
  LuReceiptText,
  LuStar,
  LuUser,
} from "react-icons/lu";

import {
  getNotificationsApi,
  getUnreadNotificationCountApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  type NotificationModel,
} from "@/features/notifications/api/notifications.api";

/** How often the unread count refreshes while the app is open. */
const POLL_MS = 30_000;

const MODULE_ICON: Record<string, React.ReactNode> = {
  lead: <LuUser size={14} />,
  opportunity: <LuStar size={14} />,
  quotation: <LuFileText size={14} />,
  sales_order: <LuClipboardList size={14} />,
  proforma_invoice: <LuReceiptText size={14} />,
};

const MODULE_LABEL: Record<string, string> = {
  lead: "Lead",
  opportunity: "Opportunity",
  quotation: "Quotation",
  sales_order: "Sales Order",
  proforma_invoice: "Proforma Invoice",
};

/** "Just now", "5 min ago", "3 hr ago", "2 days ago", then the date. */
function timeAgo(value?: string | null) {
  if (!value) return "";

  // The backend stores naive UTC timestamps.
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (Number.isNaN(seconds)) return "";
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 7 * 86400) {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString("en-IN");
}

/**
 * The navbar bell: unread badge, and a panel of the latest notifications.
 * Opening a notification marks it read and goes to its record.
 */
export default function NotificationBell() {
  const router = useRouter();
  const ref = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationModel[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await getUnreadNotificationCountApi());
    } catch {
      // The bell stays usable without a count.
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getNotificationsApi(30);
      setItems(result.items);
      setUnread(result.unreadCount);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Count on load, then every 30s and whenever the tab comes back. */
  useEffect(() => {
    refreshCount();

    const timer = window.setInterval(refreshCount, POLL_MS);
    const onFocus = () => refreshCount();

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  /* Close on an outside click or Escape. */
  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openNotification = async (notification: NotificationModel) => {
    if (!notification.is_read) {
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        ),
      );
      setUnread((count) => Math.max(0, count - 1));

      markNotificationReadApi(notification.id).catch(() => refreshCount());
    }

    setOpen(false);

    if (notification.link) router.push(notification.link);
  };

  const markAllRead = async () => {
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnread(0);

    try {
      await markAllNotificationsReadApi();
    } catch {
      loadList();
    }
  };

  const visible = showUnreadOnly ? items.filter((item) => !item.is_read) : items;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#141414] transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#0b2034]"
      >
        <LuBell size={20} />

        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#fb3748] px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#051422]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#17304a] dark:bg-[#071929]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[#17304a]">
            <div>
              <p className="text-[14px] font-semibold text-[#141414] dark:text-white">
                Notifications
              </p>
              <p className="text-[11px] text-[#777777] dark:text-slate-400">
                {unread ? `${unread} unread` : "You're all caught up"}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowUnreadOnly((value) => !value)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  showUnreadOnly
                    ? "bg-[#233353] text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#0b2034]"
                }`}
              >
                Unread
              </button>

              <button
                type="button"
                disabled={!unread}
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#233353] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-sky-300 dark:hover:bg-[#0b2034]"
              >
                <LuCheckCheck size={13} />
                Mark all read
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">Loading…</p>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <LuBell size={22} className="text-slate-300" />
                <p className="text-xs text-slate-400">
                  {showUnreadOnly ? "No unread notifications." : "No notifications yet."}
                </p>
              </div>
            ) : (
              visible.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 dark:border-[#17304a]/60 dark:hover:bg-[#0b2034] ${
                    notification.is_read ? "" : "bg-[#f5f8fd] dark:bg-[#0a1e33]"
                  }`}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#233353] dark:bg-[#0b2034] dark:text-sky-300">
                    {MODULE_ICON[notification.module] || <LuBell size={14} />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={`text-[12px] text-[#141414] dark:text-white ${
                          notification.is_read ? "font-medium" : "font-semibold"
                        }`}
                      >
                        {notification.title}
                      </span>

                      <span className="shrink-0 text-[10px] text-[#777777] dark:text-slate-400">
                        {timeAgo(notification.created_at)}
                      </span>
                    </span>

                    {notification.message && (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] text-slate-600 dark:text-slate-300">
                        {notification.message}
                      </span>
                    )}

                    <span className="mt-1 block text-[10px] text-[#777777] dark:text-slate-400">
                      {MODULE_LABEL[notification.module] || "Update"}
                      {notification.actor_name ? ` · by ${notification.actor_name}` : ""}
                    </span>
                  </span>

                  {!notification.is_read && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#fb3748]" aria-label="Unread" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
