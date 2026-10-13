"use client";

/**
 * States master.
 *
 * The states we trade in, and the two-digit GST code each one carries.
 * That code is not decoration: the seller's state against the buyer's is
 * what decides whether a sale is taxed as CGST plus SGST or as one IGST
 * line, so a wrong code taxes every invoice to that state the wrong way.
 *
 * The codes themselves are set by statute rather than by us, so the form
 * checks what is typed against the official list and says so rather than
 * accepting a number that will quietly misclassify a sale.
 */

import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiMapPin, FiPlus, FiTrash2 } from "react-icons/fi";

import PageHeader from "@/components/ui/PageHeader";
import { ListPage, ListToolbar, PrimaryAction } from "@/components/crm/ListPageShell";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";

interface StateRow {
  id: string;
  name: string;
  code?: string | null;
  /** The two-digit GST code as set on this screen. Blank means the
   *  statutory table decides it. */
  gst_code?: string | null;
  country?: string | null;
}

/**
 * The statutory GST state codes, as the server's own table has them.
 *
 * The `code` stored against a state is the postal abbreviation - UP, KL -
 * which is what the dropdowns show. The tax does not read it: the server
 * resolves the GST code from the state's *name*, so the two are different
 * answers to different questions and only the second decides a split.
 * Both are shown, and a stored code is only queried when somebody has
 * typed a number into it that contradicts the statutory one.
 */
const GST_STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  punjab: "03",
  chandigarh: "04",
  uttarakhand: "05",
  haryana: "06",
  delhi: "07",
  rajasthan: "08",
  "uttar pradesh": "09",
  bihar: "10",
  sikkim: "11",
  "arunachal pradesh": "12",
  nagaland: "13",
  manipur: "14",
  mizoram: "15",
  tripura: "16",
  meghalaya: "17",
  assam: "18",
  "west bengal": "19",
  jharkhand: "20",
  odisha: "21",
  chhattisgarh: "22",
  "madhya pradesh": "23",
  gujarat: "24",
  "dadra and nagar haveli and daman and diu": "26",
  maharashtra: "27",
  karnataka: "29",
  goa: "30",
  lakshadweep: "31",
  kerala: "32",
  "tamil nadu": "33",
  puducherry: "34",
  "andaman and nicobar islands": "35",
  telangana: "36",
  "andhra pradesh": "37",
  ladakh: "38",
};

export default function StatesPage() {
  const { addToast } = useUIStore();

  const superAdmin = useAuthStore((state) => state.user?.is_super_admin === true);

  const [states, setStates] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [toDelete, setToDelete] = useState<StateRow | null>(null);

  const [editing, setEditing] = useState<StateRow | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gstCode, setGstCode] = useState("");
  const [country, setCountry] = useState("India");

  const fetchStates = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/v1/states/");
      setStates(data?.data || []);
    } catch (error) {
      console.error(error);
      addToast("Could not load the states.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  /* Resolved from the name as it is typed, so the form can say what this
     state will actually be taxed as before it is saved. */
  const official = GST_STATE_CODES[name.trim().toLowerCase()];

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCode("");
    setGstCode("");
    setCountry("India");
    setShowForm(true);
  };

  const openEdit = (state: StateRow) => {
    setEditing(state);
    setName(state.name || "");
    setCode(String(state.code || ""));
    setGstCode(String(state.gst_code || ""));
    setCountry(state.country || "India");
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      addToast("A state name is required.", "warning");
      return;
    }

    const digits = gstCode.replace(/\D/g, "");

    if (gstCode.trim() && digits.length !== 2) {
      addToast("A GST state code is two digits, for example 23.", "warning");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase() || undefined,
        /* Empty means "use the statutory code", which is what most
           states want - so it is sent as an empty string rather than
           left out, or an edit could never clear an override. */
        gst_code: digits,
        country: country.trim() || "India",
      };

      if (editing) {
        await api.put(`/api/v1/states/${editing.id}`, payload);
      } else {
        await api.post("/api/v1/states/", payload);
      }

      addToast(editing ? "State updated." : "State added.", "success");
      setShowForm(false);
      fetchStates();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That state could not be saved.";
      addToast(detail, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;

    setDeleting(true);

    try {
      await api.delete(`/api/v1/states/${toDelete.id}`);
      addToast("State removed.", "success");
      setToDelete(null);
      fetchStates();
    } catch (error) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That state could not be removed.";
      addToast(detail, "error");
    } finally {
      setDeleting(false);
    }
  };

  const term = search.trim().toLowerCase();

  const filtered = states.filter((state) =>
    [state.name, state.code, state.country]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term)),
  );

  return (
    <ListPage>
      <PageHeader
        title="States Master"
        description="The states we trade in. The GST code decides whether a sale is taxed as CGST + SGST or as IGST, and can be set here; left blank it follows the statutory code for the name. The abbreviation is what the dropdowns show."
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search states"
        trailing={
          superAdmin ? (
            <PrimaryAction onClick={openAdd} icon={<FiPlus size={14} />}>
              Add State
            </PrimaryAction>
          ) : undefined
        }
      />

      <Table
        headers={["State", "GST Code", "Abbreviation", "Country", "Actions"]}
        loading={loading}
      >
        {filtered.map((state) => {
          const statutory = GST_STATE_CODES[String(state.name || "").toLowerCase()];
          const set = String(state.gst_code || "").trim();
          const abbreviation = String(state.code || "").trim();

          /* What the tax will actually use: what somebody set here, and
             the statutory table only where nothing has been. */
          const effective = set || statutory;

          /* Not an error - overriding is the point of the field - but
             worth saying out loud, because it is the one row that will
             not behave the way the statute book reads. */
          const overridden = Boolean(set && statutory && set !== statutory);

          return (
            <tr
              key={state.id}
              className="transition-all duration-150 hover:bg-slate-50/50 dark:hover:bg-[#071929]/20"
            >
              <td className="px-5 py-4 text-sm font-bold text-slate-800 dark:text-white">
                <div className="flex items-center gap-2">
                  <FiMapPin className="text-primary" />
                  <span>{state.name}</span>
                </div>
              </td>

              {/* What the tax will actually use. */}
              <td className="px-5 py-4 font-mono text-xs">
                {effective ? (
                  <span className="text-slate-700 dark:text-slate-200">
                    {effective}
                  </span>
                ) : (
                  <span className="font-sans text-[11px] text-amber-600">
                    not set - add one to tax this state
                  </span>
                )}

                {overridden && (
                  <span className="ml-2 font-sans text-[10px] text-amber-600">
                    set here; statute says {statutory}
                  </span>
                )}
              </td>

              <td className="px-5 py-4 font-mono text-xs text-slate-500">
                {abbreviation || "-"}
              </td>

              <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                {state.country || "India"}
              </td>

              <td className="px-5 py-4 text-right">
                <div className="flex justify-end gap-1.5">
                  {superAdmin && (
                    <button
                      onClick={() => openEdit(state)}
                      className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#233353] dark:hover:bg-[#0d2336] dark:hover:text-white"
                      title={`Edit ${state.name}`}
                    >
                      <FiEdit2 className="text-sm" />
                    </button>
                  )}

                  {superAdmin && (
                    <button
                      onClick={() => setToDelete(state)}
                      className="cursor-pointer rounded-lg border-none bg-transparent p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-[#0d2336]"
                      title={`Delete ${state.name}`}
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? `Edit ${editing.name}` : "Add State"}
      >
        <form onSubmit={save} className="space-y-4">
          <Input
            label="State Name *"
            required
            placeholder="e.g. Uttar Pradesh"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <Input
            label="Abbreviation"
            placeholder="e.g. UP"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />

          {/* The code the tax reads. Left blank it follows the statute
              book, which is what nearly every state wants; filled in, it
              wins - so a state the shipped table has never heard of can
              be taxed correctly from this screen rather than waiting on
              a release. */}
          <Input
            label="GST State Code"
            inputMode="numeric"
            maxLength={2}
            placeholder={official ? `${official} (statutory)` : "e.g. 23"}
            value={gstCode}
            onChange={(event) =>
              setGstCode(event.target.value.replace(/\D/g, "").slice(0, 2))
            }
          />

          {name.trim() && (
            <p className="-mt-2 text-[11px] text-slate-500">
              {gstCode.trim() ? (
                official && gstCode.trim() !== official ? (
                  <span className="font-medium text-amber-600">
                    The statutory code for this name is {official}. {gstCode}{" "}
                    will be used instead, on every invoice billed here.
                  </span>
                ) : (
                  <>
                    A sale billed here is taxed against code <b>{gstCode}</b>.
                  </>
                )
              ) : official ? (
                <>
                  Left blank, this state is taxed as <b>{official}</b> - the
                  statutory code for that name.
                </>
              ) : (
                <span className="font-medium text-amber-600">
                  No statutory code is known for this name, so leaving this
                  blank means a sale billed here is taxed as interstate.
                  Enter the two-digit code.
                </span>
              )}
            </p>
          )}

          <Input
            label="Country"
            placeholder="India"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editing ? "Save Changes" : "Save State"}
            </Button>
          </div>
        </form>
      </Modal>

      {toDelete && (
        <Modal isOpen onClose={() => setToDelete(null)} title="Delete State">
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Remove{" "}
              <span className="font-bold text-slate-800 dark:text-white">
                {toDelete.name}
              </span>
              ? This is permanent. Records already filed against it keep the
              state they were saved with.
            </p>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
              <Button variant="outline" onClick={() => setToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleting}>
                Delete State
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ListPage>
  );
}
