import api from "@/lib/axios";

export type NotificationModule =
  | "lead"
  | "opportunity"
  | "quotation"
  | "sales_order"
  | "proforma_invoice";

export interface NotificationModel {
  id: number;
  module: NotificationModule | string;
  entity_id: number;
  /** Activity headline, e.g. "Proforma Invoice Generated". */
  action: string;
  title: string;
  /** "#SO-00003 · BrightEdge Distributors — remarks". */
  message?: string | null;
  /** Where the record opens, e.g. "/sales/orders/3". */
  link?: string | null;
  actor_name?: string | null;
  is_read: boolean;
  created_at?: string | null;
}

const BASE = "/api/v1/notifications";

export const getNotificationsApi = async (
  limit = 30,
): Promise<{ items: NotificationModel[]; unreadCount: number }> => {
  const { data } = await api.get(BASE, { params: { limit } });

  return {
    items: Array.isArray(data?.data) ? data.data : [],
    unreadCount: Number(data?.unread_count || 0),
  };
};

export const getUnreadNotificationCountApi = async (): Promise<number> => {
  const { data } = await api.get(`${BASE}/unread-count`);
  return Number(data?.data?.unread_count || 0);
};

export const markNotificationReadApi = async (
  notificationId: number,
): Promise<NotificationModel> => {
  const { data } = await api.put(`${BASE}/${notificationId}/read`);
  return data.data;
};

export const markAllNotificationsReadApi = async (): Promise<number> => {
  const { data } = await api.put(`${BASE}/read-all`);
  return Number(data?.data?.updated || 0);
};
