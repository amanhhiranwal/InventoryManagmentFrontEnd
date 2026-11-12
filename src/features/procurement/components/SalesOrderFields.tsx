"use client";

/* The parts of a requisition's request section both forms share - the
 * employee's New Requisition and the desk's New Procurement - so a fix to
 * either lands once: the sales order picker and the cost centre, which is
 * the company the purchase is for.
 *
 * The picker searches the orders the server lets this person see (the
 * sales chart only, scoped by the reporting line) as they type. */

import { useEffect, useState } from "react";

import { salesOrderOptionsApi, type CompanyOption } from "../api/procurement.api";

type Order = { id: number; order_number: string; customer_name: string };

/** The chosen company while it is still one of theirs, or the only one
 * there is to choose. A draft keeps its company even after it leaves the
 * person's profile; that one has to be chosen again. */
export const companyValue = (chosen: string, companies: CompanyOption[]) =>
  chosen && companies.some((c) => c.id === chosen)
    ? chosen
    : companies.length === 1
      ? companies[0].id
      : "";

/** Cost Center: the companies on the person's profile. */
export function CompanyField({
  id,
  value,
  companies,
  onChange,
  fieldClass,
  labelClass,
}: {
  id: string;
  value: string;
  companies: CompanyOption[];
  onChange: (companyId: string) => void;
  fieldClass: string;
  labelClass: string;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>Cost Center{companies.length ? " *" : ""}</label>
      <select id={id} className={fieldClass} value={companyValue(value, companies)} onChange={(e) => onChange(e.target.value)}>
        {companies.length !== 1 && (
          <option value="">{companies.length ? "Select company" : "No company on your profile"}</option>
        )}
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

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
