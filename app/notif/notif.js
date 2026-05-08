"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { useNotifSettings } from "@/hooks/useNotifSettings";

const MAX_NOTIFICATIONS = 3;
const AUTO_DISMISS_TIME = 5000;

export default function NotificationListener() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const notifSettings = useNotifSettings();

  // The chat ID the user is currently viewing (if on /chat?id=X)
  const activeChatId = pathname === '/chat' ? searchParams.get('id') : null;

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Auto-dismiss last notification
  useEffect(() => {
    if (notifications.length > 0) {
      const lastNotification = notifications[notifications.length - 1];
      const timer = setTimeout(() => {
        dismissNotification(lastNotification.id);
      }, AUTO_DISMISS_TIME);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          if (!payload?.new) return;
          const message = payload.new;

          // Fetch sender name
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", message.sender_id)
            .single();

          const senderName = profile?.full_name || "Someone";
          const body = message.content || "Sent a message";

          // Suppress all notifications if the user is already inside this conversation
          const isViewingThisChat = String(activeChatId) === String(message.chat_id);
          if (isViewingThisChat) return;

          // --- chatMessages setting: show in-app toast ---
          if (notifSettings.chatMessages) {
            const nextNotification = {
              id: `${message.id}-${Date.now()}`,
              chatId: message.chat_id,
              senderName,
              body,
            };
            setNotifications((prev) =>
              [nextNotification, ...prev].slice(0, MAX_NOTIFICATIONS)
            );
          }

          // --- browserAlerts setting: fire OS notification ---
          if (notifSettings.browserAlerts && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification(`💬 ${senderName}`, {
                body,
                icon: "/favicon.ico",
                tag: `chat-${message.chat_id}`,
              });
            } else if (Notification.permission !== "denied") {
              const permission = await Notification.requestPermission();
              if (permission === "granted") {
                new Notification(`💬 ${senderName}`, {
                  body,
                  icon: "/favicon.ico",
                  tag: `chat-${message.chat_id}`,
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user, notifSettings.chatMessages, notifSettings.browserAlerts]);

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleOpenChat = (chatId, notificationId) => {
    if (!chatId) return;
    dismissNotification(notificationId);
    router.push(`/chat?id=${chatId}`);
  };

  // Don't render the container at all if in-app toasts are disabled
  if (!notifSettings.chatMessages) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-[340px] items-center">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            onClick={() => handleOpenChat(notification.chatId, notification.id)}
            className="group pointer-events-auto relative w-full rounded-3xl border border-orange-500/20 bg-black/90 p-4 text-left text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transition hover:bg-white/5 cursor-pointer"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-2xl bg-orange-500/10 p-2 shrink-0">
                  <MessageCircle size={18} className="text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black truncate">{notification.senderName}</p>
                  <p className="mt-0.5 truncate text-xs text-white/70">{notification.body}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification(notification.id);
                }}
                className="text-white/50 hover:text-white p-1 transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}