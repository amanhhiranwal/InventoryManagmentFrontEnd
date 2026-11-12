"use client";

/* The parts of a requisition's request section both forms share - the
 * employee's New Requisition and the desk's New Procurement - so a fix to
 * either lands once: the sales order picker and the cost centres offered
 * for a department.
 *
 * The picker searches the orders the server lets this person see (the
 * sales chart only, scoped by the reporting line) as they type. */

import { useEffect, useState } from "react";

import { salesOrderOptionsApi, type CostCenter } from "../api/procurement.api";

type Order = { id: number; order_number: string; customer_name: string };

/** The cost centres for a department, plus those that belong to none. */
export const costCentersFor = (centers: CostCenter[] | undefined, departmentId: string) =>
  (centers || []).filter((c) => !departmentId || !c.department_id || String(c.department_id) === departmentId);

export default function SalesOrderFields({
  idPrefix,
  value,
  customer,
  current,
  onChange,
  fieldClass,
  labelClass,
}: {
  idPrefix: string;
  /** The chosen order's id, as a string ("" for none). */
  value: string;
  customer?: string;
  /** The order already on a saved requisition, kept selectable. */
  current?: { id: number; number?: string | null } | null;
  onChange: (orderId: string, customerName: string | null) => void;
  fieldClass: string;
  labelClass: string;
}) {
  const [search, setSearch] = useState(current?.number || "");
  const [orders, setOrders] = useState<Order[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      salesOrderOptionsApi(search.trim())
        .then((rows) => {
          setOrders(rows);
          setFailed(false);
        })
        .catch(() => {
          setOrders([]);
          setFailed(true);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-so-search`}>Find Sales Order *</label>
        <input
          id={`${idPrefix}-so-search`}
          className={fieldClass}
          placeholder="Order number or customer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-so`}>Sales Order *</label>
        <select
          id={`${idPrefix}-so`}
          className={fieldClass}
          value={value}
          onChange={(e) => {
            const order = orders.find((o) => String(o.id) === e.target.value);
            onChange(e.target.value, order ? order.customer_name : null);
          }}
        >
          <option value="">{failed ? "Orders could not be loaded" : orders.length ? "Select order" : "No orders found"}</option>
          {current?.id && !orders.some((o) => o.id === current.id) && (
            <option value={current.id}>{current.number}</option>
          )}
          {orders.map((o) => (
            <option key={o.id} value={o.id}>{o.order_number}: {o.customer_name}</option>
          ))}
        </select>
      </div>
      {customer !== undefined && (
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-customer`}>Customer</label>
          <input id={`${idPrefix}-customer`} className={fieldClass} value={customer} readOnly />
        </div>
      )}
    </>
  );
}
