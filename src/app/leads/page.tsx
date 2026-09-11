"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import * as XLSX from "xlsx";

import { useUIStore } from "@/lib/store/ui.store";

import {
  createLeadApi,
  getLeadActivitiesApi,
  getLeadsApi,
  logLeadActivityApi,
  progressLeadApi,
  updateLeadApi,
  Lead,
  LeadActivity,
  LogLeadActivityPayload,
} from "@/features/workflows/api/workflows.api";

import { useRouter } from "next/navigation";
import { getUsersApi, User } from "@/features/users/api/users.api";
import StatCard from "@/components/crm/StatCard";
import Pagination from "@/components/crm/Pagination";
import { StatusPill } from "@/components/crm/Pill";
import { FormCard, FormSectionBlock } from "@/components/crm/FormCard";
import FormPageHeader, {
  CancelButton,
  DraftButton,
  SubmitButton,
} from "@/components/crm/FormPageHeader";
import { getCustomerTypesApi, CustomerTypeModel } from "@/features/inventory/api/inventory.api";
import { getStatesApi, StateModel } from "@/features/locations/api/locations.api";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import {
  FiPlus,
  FiRefreshCw,
  FiMoreVertical,
  FiSearch,
  FiSliders,
  FiDownload,
  FiGrid,
  FiPhone,
  FiUserPlus,
  FiFileText,
  FiLink,
  FiCalendar,
  FiMapPin,
  FiMail,
  FiMessageSquare,
  FiEdit3,
  FiCheckCircle,
  FiPhoneCall,
  FiXCircle,
  FiUploadCloud,
  FiPaperclip,
  FiUser,
  FiBriefcase,
  FiShield,
  FiInfo,
  FiArrowUpRight,
  FiX,
  FiChevronDown,
} from "react-icons/fi";

import { CgSpinner } from "react-icons/cg";

/* ============================================================================
   TYPES
============================================================================ */

interface LeadDetails {
  customerType: string;
  contactName: string;
  organizationName: string;
  website: string;

  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;


  gstNumber: string;
  panNumber: string;
  coiNumber: string;

  designation: string;
  mobileNumber: string;
  email: string;

  leadSource: string;
  remarks: string;
  attachments: string[];
}

interface LeadFormState extends LeadDetails {
  assignedToId: string;
}

/* Shape of the third-party integration capture form. The type was referenced
   but never declared, which left the project unable to type-check or build. */
interface IntegrationLeadState {
  source: string;
  contactName: string;
  organizationName: string;
  email: string;
  mobileNumber: string;
  website: string;
  remarks: string;
  assignedToId: string;
}

interface LeadFilters {
  dateFrom: string;
  dateTo: string;
  customerType: string;
  assignedTo: string;
  status: string;
  state: string;
}

/* ============================================================================
   CONSTANTS
============================================================================ */

const PAGE_SIZE = 10;

const EMPTY_FORM: LeadFormState = {
  customerType: "",
  contactName: "",
  organizationName: "",
  website: "",

  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "India",


  gstNumber: "",
  panNumber: "",
  coiNumber: "",

  designation: "",
  mobileNumber: "",
  email: "",

  leadSource: "",
  remarks: "",
  attachments: [],

  assignedToId: "",
};

const EMPTY_FILTERS: LeadFilters = {
  dateFrom: "",
  dateTo: "",
  customerType: "",
  assignedTo: "",
  status: "all",
  state: "",
};





/* Canonical lead pipeline shown in the details drawer. LOST is rendered as
   a separate terminal cell because it is an outcome, not a step. */
const LEAD_PIPELINE: { label: string; status: string }[] = [
  { label: "New", status: "NEW" },
  { label: "Contacted", status: "CONTACTED" },
  { label: "Qualified", status: "QUALIFIED" },
  { label: "Converted", status: "CONVERTED" },
];

/* Mirrors LEAD_TRANSITIONS in app/core/workflow_status.py. Kept here so the
   UI only ever offers a step the backend will accept, rather than firing the
   call and surfacing a 400. CONVERTED and LOST are terminal. */
const LEAD_NEXT_STATUSES: Record<string, string[]> = {
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["QUALIFIED", "LOST"],
  QUALIFIED: ["CONVERTED", "LOST"],
  CONVERTED: [],
  LOST: [],
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Dead",
};

function leadStatusLabel(status?: string) {
  if (!status) return "New";

  return LEAD_STATUS_LABELS[status] || status;
}

function canAdvanceLead(lead: Lead, target: string) {
  return (LEAD_NEXT_STATUSES[lead.status] || []).includes(target);
}

/* What the Log Activity form may move a lead to. CONVERTED is excluded on
   purpose: converting also has to create the opportunity, so it runs through
   the New Opportunity page rather than being set from a dropdown. The
   backend refuses it here too. */
function logActivityStatuses(status: string) {
  return (LEAD_NEXT_STATUSES[status] || []).filter(
    (next) => next !== "CONVERTED",
  );
}

const LEAD_SOURCES = ["Marketing", "Cold Calling", "In-bound"];

const COUNTRIES = ["India", "United States", "China", "Malaysia", "Indonesia"];

/* ============================================================================
   HELPERS
============================================================================ */

function parseLeadDescription(description?: string): LeadDetails {
  const result: LeadDetails = {
    customerType: "",
    contactName: "",
    organizationName: "",
    website: "",

    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",


    gstNumber: "",
    panNumber: "",
    coiNumber: "",

    designation: "",
    mobileNumber: "",
    email: "",

    leadSource: "",
    remarks: "",
    attachments: [],
  };

  if (!description) {
    return result;
  }

  if (description.startsWith("CRM_META:")) {
    try {
      const parsed = JSON.parse(
        description.replace(/^CRM_META:/, ""),
      ) as Partial<LeadDetails>;

      return {
        ...result,
        ...parsed,
        attachments: Array.isArray(parsed.attachments)
          ? parsed.attachments
          : [],
      };
    } catch {
      // Continue to legacy parser.
    }
  }

  description.split("|").forEach((part) => {
    const value = part.trim();

    if (value.startsWith("Contact Name:")) {
      result.contactName = value.replace("Contact Name:", "").trim();
    }

    if (value.startsWith("Email:")) {
      result.email = value.replace("Email:", "").trim();
    }

    if (value.startsWith("Organization:")) {
      result.organizationName = value.replace("Organization:", "").trim();
    }

    if (value.startsWith("Type:")) {
      result.customerType = value.replace("Type:", "").trim();
    }

    if (value.startsWith("Address:")) {
      const address = value.replace("Address:", "").trim();
      const pieces = address.split(",").map((item) => item.trim());

      result.address = pieces[0] || "";
      result.city = pieces[1] || "";
      result.state = pieces[2] || "";

      const last = pieces.slice(3).join(" ");
      const pinMatch = last.match(/\b\d{5,6}\b/);

      if (pinMatch) {
        result.zipCode = pinMatch[0];
      }
    }

    if (value.startsWith("GST:")) {
      result.gstNumber = value.replace("GST:", "").trim();
    }

    if (value.startsWith("PAN:")) {
      result.panNumber = value.replace("PAN:", "").trim();
    }

    if (value.startsWith("COI:")) {
      result.coiNumber = value.replace("COI:", "").trim();
    }

    if (value.startsWith("Lead Source:")) {
      result.leadSource = value.replace("Lead Source:", "").trim();
    }
  });

  return result;
}

function getLeadDetails(lead: Lead): LeadDetails {
  const parsed = parseLeadDescription(lead.description);
  return {
    customerType: lead.customer_type_name || parsed.customerType || "",
    contactName: lead.contact_name || parsed.contactName || "",
    organizationName: lead.organization_name || parsed.organizationName || "",
    website: lead.website || parsed.website || "",
    address: lead.office_address || parsed.address || "",
    city: lead.city || parsed.city || "",
    state: lead.state_name || parsed.state || "",
    zipCode: lead.zip_code || parsed.zipCode || "",
    country: lead.country || parsed.country || "India",

    gstNumber: lead.gst_number || parsed.gstNumber || "",
    panNumber: lead.pan_number || parsed.panNumber || "",
    coiNumber: lead.coi_number || parsed.coiNumber || "",
    designation: lead.designation || parsed.designation || "",
    mobileNumber: lead.mobile_number || parsed.mobileNumber || "",
    email: lead.email || parsed.email || "",
    leadSource: lead.lead_source_name || parsed.leadSource || "",
    remarks: lead.remarks || parsed.remarks || "",
    attachments: parsed.attachments || [],
  };
}

function serializeLeadDetails(details: LeadDetails) {
  return `CRM_META:${JSON.stringify(details)}`;
}

function getLeadDisplayName(lead: Lead) {
  const details = getLeadDetails(lead);

  return (
    details.contactName ||
    lead.title?.split("(")[0]?.trim() ||
    lead.title ||
    "Unnamed Lead"
  );
}

function getLeadCompany(lead: Lead) {
  const details = getLeadDetails(lead);

  return details.organizationName || lead.title?.match(/\((.*?)\)/)?.[1] || "—";
}

function getLeadState(lead: Lead) {
  return getLeadDetails(lead).state || "—";
}

/* Shown under the email in the Customer Name column: the most specific
   place we hold for the lead, widening out to the country. */
function formatLeadLocation(details: LeadDetails) {
  const parts = [details.city, details.state, details.zipCode].filter(Boolean);

  if (parts.length) return parts.join(", ");

  return details.address || details.country || "No address";
}

function getLeadCustomerType(lead: Lead) {
  return getLeadDetails(lead).customerType || "—";
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* Timestamp shown on an activity card. Recent entries read better relative -
   "Today, 2:15 PM" - because the timeline is mostly consulted for what just
   happened; anything older falls back to a plain date. */
function formatActivityStamp(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  const time = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const startOfDay = (input: Date) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();

  const dayDiff = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86400000,
  );

  if (dayDiff === 0) return `Today, ${time}`;

  if (dayDiff === 1) return "Yesterday";

  return formatDate(value);
}

/* Full date and time for the footer line of an activity card. */
function formatActivityDateTime(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return `${formatDate(value)} at ${date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
}

function formatLeadId(id: number | string) {
  const str = String(id);
  return `#LD-${str.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function getUserName(user: User) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim();
}

function getInitials(value?: string) {
  if (!value) return "U";

  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function isLeadDead(lead: Lead) {
  return lead.status === "LOST" || lead.stage === "dead";
}

function isLeadQualified(lead: Lead) {
  return (
    lead.status === "QUALIFIED" ||
    lead.status === "CONVERTED" ||
    lead.stage === "opportunity" ||
    lead.stage === "quotation"
  );
}

function isLeadNew(lead: Lead) {
  return lead.status === "NEW" || lead.stage === "lead";
}

function formatDateInput(value: string) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN");
}

/* ============================================================================
   MAIN PAGE
============================================================================ */

export default function LeadsPage() {
  const { addToast } = useUIStore();

  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [customerTypesList, setCustomerTypesList] = useState<CustomerTypeModel[]>([]);
  const [dbStates, setDbStates] = useState<string[]>([]);
  const [statesList, setStatesList] = useState<StateModel[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showTopMenu, setShowTopMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [showFilter, setShowFilter] = useState(false);

  /*
   * Active filters are only changed after Apply Filter.
   */
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<LeadFilters>(EMPTY_FILTERS);

  const [showExcelModal, setShowExcelModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState("");
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [integrationLead, setIntegrationLead] = useState<IntegrationLeadState>({
    source: "",
    contactName: "",
    organizationName: "",
    email: "",
    mobileNumber: "",
    website: "",
    remarks: "",
    assignedToId: "",
  });

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  /* Activity History for the lead the drawer is showing. Held here rather
     than inside the drawer so a status change made from the row menu can
     refresh it without the drawer having to watch for it. */
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  /*
   * Create/Edit page mode.
   */
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");

  const [form, setForm] = useState<LeadFormState>(EMPTY_FORM);

  const [rowMenuLeadId, setRowMenuLeadId] = useState<number | string | null>(null);

  /* Id of the lead whose status call is in flight, so the row and the drawer
     can disable their actions instead of allowing a double submit. */
  const [statusUpdatingId, setStatusUpdatingId] = useState<
    number | string | null
  >(null);

  /*
   * Pagination.
   */
  const [currentPage, setCurrentPage] = useState(1);

  /*
   * CSV / Excel import.
   */
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const topMenuRef = useRef<HTMLDivElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  /* --------------------------------------------------------------------------
     FETCH
  -------------------------------------------------------------------------- */

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getLeadsApi();
      setLeads(data || []);
    } catch (err) {
      console.error(err);
      addToast("Failed to load leads from system.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const loadActivities = useCallback(
    async (leadId: number | string) => {
      try {
        setActivitiesLoading(true);

        const data = await getLeadActivitiesApi(leadId);

        setActivities(data || []);
      } catch (error) {
        console.error(error);

        setActivities([]);

        addToast("Failed to load the activity history.", "error");
      } finally {
        setActivitiesLoading(false);
      }
    },
    [addToast],
  );

  const fetchUsers = useCallback(async () => {
    try {
      const response = await getUsersApi(1, 100);
      if (response && Array.isArray(response.data)) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  }, []);

  const fetchCustomerTypes = useCallback(async () => {
    try {
      const response = await getCustomerTypesApi();
      if (Array.isArray(response)) {
        setCustomerTypesList(response);
        setCustomerTypes(response.map((ct) => ct.name));
      }
    } catch (error) {
      console.error("Failed to load customer types:", error);
    }
  }, []);

  const fetchStates = useCallback(async () => {
    try {
      const response = await getStatesApi();
      if (Array.isArray(response)) {
        setStatesList(response);
        setDbStates(response.map((st) => st.name));
      }
    } catch (error) {
      console.error("Failed to load states:", error);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchUsers();
    fetchCustomerTypes();
    fetchStates();
  }, [fetchLeads, fetchUsers, fetchCustomerTypes, fetchStates]);

  /* --------------------------------------------------------------------------
     CLOSE MENUS WHEN CLICKING OUTSIDE
  -------------------------------------------------------------------------- */

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node;

      if (filterRef.current && !filterRef.current.contains(target)) {
        setShowFilter(false);
      }

      if (topMenuRef.current && !topMenuRef.current.contains(target)) {
        setShowTopMenu(false);
      }

      if (addMenuRef.current && !addMenuRef.current.contains(target)) {
        setShowAddMenu(false);
      }

      /* Only close the row menu when the click landed outside it. Closing
         unconditionally here unmounted the menu on mousedown, which fires
         before click — so the row actions never received their click and
         appeared to do nothing. */
      if (
        target instanceof Element &&
        target.closest("[data-row-menu]")
      ) {
        return;
      }

      setRowMenuLeadId(null);
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  /* --------------------------------------------------------------------------
     KPI
  -------------------------------------------------------------------------- */

  const totalLeads = leads.length;

  const newLeads = leads.filter(isLeadNew).length;

  const qualifiedLeads = leads.filter(isLeadQualified).length;

  const deadLeads = leads.filter(isLeadDead).length;

  /* --------------------------------------------------------------------------
     FILTERING
  -------------------------------------------------------------------------- */

  const filteredLeads = useMemo(() => {
    const query = search.toLowerCase().trim();

    return leads.filter((lead) => {
      const details = parseLeadDescription(lead.description);

      const searchableText = [
        lead.title,
        getLeadDisplayName(lead),
        details.organizationName,
        details.email,
        details.mobileNumber,
        details.website,
        details.address,
        details.city,
        details.state,
        details.customerType,
        details.leadSource,
        lead.assigned_to_name,
        lead.creator_name,
        lead.status,
        lead.stage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      const matchesCustomerType =
        !filters.customerType || details.customerType === filters.customerType;

      const matchesAssigned =
        !filters.assignedTo || lead.assigned_to_id === filters.assignedTo;

      const matchesState = !filters.state || details.state === filters.state;

      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" && !isLeadDead(lead)) ||
        (filters.status === "inactive" && isLeadDead(lead));

      const created = new Date(lead.created_at);

      const matchesDateFrom =
        !filters.dateFrom ||
        created >= new Date(`${filters.dateFrom}T00:00:00`);

      const matchesDateTo =
        !filters.dateTo || created <= new Date(`${filters.dateTo}T23:59:59`);

      return (
        matchesSearch &&
        matchesCustomerType &&
        matchesAssigned &&
        matchesState &&
        matchesStatus &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [leads, search, filters]);

  /*
   * Always go back to page 1 when search/filter changes.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters]);

  /* --------------------------------------------------------------------------
     PAGINATION
  -------------------------------------------------------------------------- */

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedLeads = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;

    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, safeCurrentPage]);

  /* --------------------------------------------------------------------------
     FORM
  -------------------------------------------------------------------------- */

  const updateForm = <K extends keyof LeadFormState>(
    field: K,
    value: LeadFormState[K],
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      assignedToId: users[0]?.id || "",
    });
  };

  const openCreatePage = () => {
    resetForm();

    setPageMode("create");

    setShowAddMenu(false);
    setShowTopMenu(false);
  };

  const openEditPage = (lead: Lead) => {
    const details = getLeadDetails(lead);

    setEditingLead(lead);

    setForm({
      ...details,
      assignedToId: lead.assigned_to_id || "",
    });

    setPageMode("edit");

    setShowDetailsModal(false);
    setRowMenuLeadId(null);
  };

  const closeLeadForm = () => {
    setPageMode("list");
    setEditingLead(null);
    resetForm();
  };

  /* --------------------------------------------------------------------------
     FORM VALIDATION
  -------------------------------------------------------------------------- */

  const validateLeadForm = () => {
    if (!form.contactName.trim()) {
      addToast("Full Name is required.", "warning");
      return false;
    }

    if (!form.organizationName.trim()) {
      addToast("Organization Name is required.", "warning");
      return false;
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      addToast("Enter a valid email address.", "warning");
      return false;
    }

    if (form.mobileNumber.trim()) {
      const phone = form.mobileNumber.replace(/\D/g, "");
      if (phone.length < 10) {
        addToast("Enter a valid mobile number.", "warning");
        return false;
      }
    }

    return true;
  };

  /* --------------------------------------------------------------------------
     CREATE
  -------------------------------------------------------------------------- */

  const handleCreateLead = async (event: FormEvent) => {
    event.preventDefault();

    if (!validateLeadForm()) return;

    try {
      setSaving(true);

      const details: LeadDetails = {
        customerType: form.customerType,
        contactName: form.contactName.trim(),
        organizationName: form.organizationName.trim(),
        website: form.website.trim(),

        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zipCode: form.zipCode.trim(),
        country: form.country,


        gstNumber: form.gstNumber.trim(),
        panNumber: form.panNumber.trim(),
        coiNumber: form.coiNumber.trim(),

        designation: form.designation.trim(),
        mobileNumber: form.mobileNumber.trim(),
        email: form.email.trim(),

        leadSource: form.leadSource,
        remarks: form.remarks.trim(),
        attachments: form.attachments,
      };

      const selectedCt = customerTypesList.find((c) => c.name === form.customerType || String(c.id) === String(form.customerType));
      const selectedSt = statesList.find((s) => s.name === form.state || String(s.id) === String(form.state));

      await createLeadApi({
        title: `${details.contactName} (${details.organizationName})`,
        contact_name: details.contactName,
        organization_name: details.organizationName,
        email: details.email,
        mobile_number: details.mobileNumber,
        website: details.website,
        office_address: details.address,
        city: details.city,
        zip_code: details.zipCode,
        country: details.country,
        gst_number: details.gstNumber,
        pan_number: details.panNumber,
        coi_number: details.coiNumber,
        designation: details.designation,
        remarks: details.remarks,
        status: "NEW",
        customer_type_id: selectedCt?.id,
        state_id: selectedSt?.id,
        assigned_to_id: form.assignedToId || undefined,
      });

      addToast("New lead created successfully.", "success");

      closeLeadForm();

      await fetchLeads();
    } catch (error) {
      console.error(error);

      addToast("Failed to create lead.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------------------------------
     UPDATE
  -------------------------------------------------------------------------- */

  const handleUpdateLead = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingLead) return;

    if (!validateLeadForm()) return;

    try {
      setSaving(true);

      const details: LeadDetails = {
        customerType: form.customerType,
        contactName: form.contactName.trim(),
        organizationName: form.organizationName.trim(),
        website: form.website.trim(),

        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zipCode: form.zipCode.trim(),
        country: form.country,


        gstNumber: form.gstNumber.trim(),
        panNumber: form.panNumber.trim(),
        coiNumber: form.coiNumber.trim(),

        designation: form.designation.trim(),
        mobileNumber: form.mobileNumber.trim(),
        email: form.email.trim(),

        leadSource: form.leadSource,
        remarks: form.remarks.trim(),
        attachments: form.attachments,
      };

      const selectedCt = customerTypesList.find((c) => c.name === form.customerType || String(c.id) === String(form.customerType));
      const selectedSt = statesList.find((s) => s.name === form.state || String(s.id) === String(form.state));

      const updated = await updateLeadApi(editingLead.id, {
        title: `${details.contactName} (${details.organizationName})`,
        contact_name: details.contactName,
        organization_name: details.organizationName,
        email: details.email,
        mobile_number: details.mobileNumber,
        website: details.website,
        office_address: details.address,
        city: details.city,
        zip_code: details.zipCode,
        country: details.country,
        gst_number: details.gstNumber,
        pan_number: details.panNumber,
        coi_number: details.coiNumber,
        designation: details.designation,
        remarks: details.remarks,
        customer_type_id: selectedCt?.id,
        state_id: selectedSt?.id,
        assigned_to_id: form.assignedToId || undefined,
      });

      const refreshedLead = {
        ...editingLead,
        ...updated,
      };

      setLeads((previous) =>
        previous.map((lead) =>
          lead.id === editingLead.id ? refreshedLead : lead,
        ),
      );

      addToast("Lead updated successfully.", "success");

      closeLeadForm();

      setDetailsLead(refreshedLead);
      setShowDetailsModal(true);
    } catch (error) {
      console.error(error);

      addToast("Failed to update lead.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------------------------------
     LEAD ACTIONS
  -------------------------------------------------------------------------- */

  /* Move a lead one step along NEW -> CONTACTED -> QUALIFIED. Without
     this there was no way to reach those states from the UI at all. */
  const advanceLeadStatus = async (lead: Lead, next: string) => {
    /* Guard here as well as in the menu so the drawer, the row menu and any
       future caller all report the same reason instead of relying on the
       backend to reject the transition. */
    const allowed = LEAD_NEXT_STATUSES[lead.status] || [];

    if (!allowed.includes(next)) {
      addToast(
        `A lead that is ${leadStatusLabel(lead.status)} cannot be moved to ${leadStatusLabel(next)}.`,
        "warning",
      );
      return;
    }

    setStatusUpdatingId(lead.id);

    try {
      await progressLeadApi(String(lead.id), {
        stage: "lead",
        status: next,
      });

      addToast(
        `${getLeadDisplayName(lead)} is now ${leadStatusLabel(next)}.`,
        "success",
      );

      setRowMenuLeadId(null);

      await fetchLeads();

      /* The move is now part of the lead's history, so the open drawer has
         to pick it up rather than keep showing the timeline as it was. */
      if (detailsLead && String(detailsLead.id) === String(lead.id)) {
        await loadActivities(lead.id);
      }
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Failed to update lead status.",
        "error",
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const markLeadDead = async (lead: Lead) => {
    if (lead.status === "LOST") {
      addToast("This lead is already marked as dead.", "info");
      return;
    }

    if (lead.status === "CONVERTED") {
      addToast(
        "A converted lead cannot be marked as dead. Close its opportunity instead.",
        "warning",
      );
      return;
    }

    setStatusUpdatingId(lead.id);

    try {
      await progressLeadApi(String(lead.id), {
        stage: "dead",
        status: "LOST",
      });

      addToast(`${getLeadDisplayName(lead)} was marked as dead.`, "success");

      setRowMenuLeadId(null);

      await fetchLeads();

      if (detailsLead && String(detailsLead.id) === String(lead.id)) {
        await loadActivities(lead.id);
      }
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Failed to mark lead as dead.",
        "error",
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  /* Opens the New Opportunity page prefilled from this lead. The
     opportunity (and the lead's move to CONVERTED) is created when that
     form is saved, not here. */
  const convertToOpportunity = (lead: Lead) => {
    if (lead.status === "CONVERTED") {
      addToast("This lead has already been converted.", "info");
      return;
    }

    if (lead.status === "LOST") {
      addToast("A lost lead cannot be converted.", "error");
      return;
    }

    /* Qualification is the gate into the opportunity pipeline. */
    if (lead.status !== "QUALIFIED") {
      addToast(
        "Mark this lead as Qualified before converting it.",
        "warning",
      );
      return;
    }

    setRowMenuLeadId(null);
    setShowDetailsModal(false);

    router.push(`/sales/opportunities?leadId=${lead.id}`);
  };

  /* The Log Activity form posts the note and the status move together, so a
     status change always carries the reason it happened. Returns whether it
     succeeded, so the form knows whether to clear itself. */
  const logActivity = async (lead: Lead, payload: LogLeadActivityPayload) => {
    setStatusUpdatingId(lead.id);

    try {
      const result = await logLeadActivityApi(lead.id, payload);

      addToast(
        payload.status
          ? `${getLeadDisplayName(lead)} is now ${leadStatusLabel(
              result.lead.status,
            )}.`
          : `Activity logged against ${getLeadDisplayName(lead)}.`,
        "success",
      );

      await fetchLeads();
      await loadActivities(lead.id);

      return true;
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Failed to log the activity.",
        "error",
      );

      return false;
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openLeadDetails = (lead: Lead) => {
    setDetailsLead(lead);
    setShowDetailsModal(true);
    setRowMenuLeadId(null);

    setActivities([]);
    loadActivities(lead.id);
  };

  /* The drawer must render the lead as it exists in the freshly fetched
     list, not the snapshot captured when it was opened. Without this the
     status strip kept showing the status the lead had on open, even though
     the change had already been saved. */
  const liveDetailsLead = useMemo(() => {
    if (!detailsLead) return null;

    return (
      leads.find((item) => String(item.id) === String(detailsLead.id)) ||
      detailsLead
    );
  }, [leads, detailsLead]);

  /* --------------------------------------------------------------------------
     FILTERS
  -------------------------------------------------------------------------- */

  const openFilters = () => {
    setDraftFilters(filters);
    setShowFilter(true);
  };

  const applyFilters = () => {
    const next = {
      ...draftFilters,
    };

    if (next.dateFrom && next.dateTo && next.dateFrom > next.dateTo) {
      const from = next.dateFrom;

      next.dateFrom = next.dateTo;
      next.dateTo = from;
    }

    setFilters(next);
    setCurrentPage(1);
    setShowFilter(false);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setCurrentPage(1);
    setShowFilter(false);
  };

  const hasActiveFilters =
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.customerType) ||
    Boolean(filters.assignedTo) ||
    filters.status !== "all" ||
    Boolean(filters.state);

  const availableStates = Array.from(
    new Set([
      ...dbStates,
      ...leads
        .map((lead) => parseLeadDescription(lead.description).state)
        .filter(Boolean),
    ]),
  );

  /* --------------------------------------------------------------------------
     EXPORT
  -------------------------------------------------------------------------- */

  const exportCSV = () => {
    if (!filteredLeads.length) {
      addToast("No leads available for export.", "warning");

      return;
    }

    const header = [
      "Lead ID",
      "Customer Name",
      "Organization",
      "Customer Type",
      "Website",
      "Email",
      "Mobile",
      "Address",
      "City",
      "State",
      "PIN / ZIP",
      "Country",
      "GST",
      "PAN",
      "COI",
      "Designation",
      "Lead Source",
      "Assigned To",
      "Status",
      "Stage",
      "Created At",
    ];

    const rows = filteredLeads.map((lead) => {
      const details = parseLeadDescription(lead.description);

      return [
        formatLeadId(lead.id),
        details.contactName,
        details.organizationName,
        details.customerType,
        details.website,
        details.email,
        details.mobileNumber,
        details.address,
        details.city,
        details.state,
        details.zipCode,
        details.country,
        details.gstNumber,
        details.panNumber,
        details.coiNumber,
        details.designation,
        details.leadSource,
        lead.assigned_to_name || "",
        lead.status,
        lead.stage,
        formatDate(lead.created_at),
      ];
    });

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setShowTopMenu(false);

    addToast("Leads exported successfully.", "success");
  };

  /* --------------------------------------------------------------------------
     KPI CHART
  -------------------------------------------------------------------------- */

  const downloadChart = () => {
    const canvas = document.createElement("canvas");

    canvas.width = 1200;
    canvas.height = 600;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 32px Arial";

    ctx.fillText("Leads Pipeline", 60, 70);

    const values = [
      {
        label: "Total Leads",
        value: totalLeads,
      },
      {
        label: "New",
        value: newLeads,
      },
      {
        label: "Qualified",
        value: qualifiedLeads,
      },
      {
        label: "Dead",
        value: deadLeads,
      },
    ];

    const max = Math.max(...values.map((item) => item.value), 1);

    const chartBottom = 500;
    const chartTop = 130;
    const barWidth = 150;
    const gap = 100;

    values.forEach((item, index) => {
      const x = 100 + index * (barWidth + gap);

      const height = (item.value / max) * (chartBottom - chartTop);

      ctx.fillStyle = "#1d2b45";

      ctx.fillRect(x, chartBottom - height, barWidth, height);

      ctx.fillStyle = "#0f172a";

      ctx.font = "bold 20px Arial";

      ctx.fillText(
        item.value.toLocaleString("en-IN"),
        x + 35,
        chartBottom - height - 15,
      );

      ctx.font = "16px Arial";

      ctx.fillText(item.label, x + 20, chartBottom + 35);
    });

    const link = document.createElement("a");

    link.download = "leads-pipeline-chart.png";

    link.href = canvas.toDataURL("image/png");

    link.click();

    setShowTopMenu(false);

    addToast("Chart downloaded.", "success");
  };

  /* --------------------------------------------------------------------------
     FILE IMPORT
  -------------------------------------------------------------------------- */

  const acceptImportFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    const allowed = ["csv", "xlsx", "xls"];

    if (!extension || !allowed.includes(extension)) {
      addToast("Please upload a CSV, XLSX or XLS file.", "warning");

      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addToast("Maximum file size is 10MB.", "warning");

      return;
    }

    setExcelFile(file);
  };

  const handleExcelFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    acceptImportFile(file);
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    setIsDraggingFile(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      acceptImportFile(file);
    }
  };

  const downloadSampleCSV = () => {
    const sample = [
      [
        "Full Name",
        "Designation",
        "Email",
        "Mobile",
        "Organization Name",
        "Organization Website",
        "Customer Type",
        "Address",
        "City",
        "State",
        "PIN / ZIP Code",
        "Country",
        "GST Number",
        "PAN Number",
        "COI",
        "Lead Source",
        "Assigned To",
        "Remarks",
      ],
      [
        "Rahul Sharma",
        "Procurement Manager",
        "rahul@example.com",
        "9876543210",
        "Example Technologies",
        "www.example.com",
        "Corporate",
        "MG Road",
        "Bengaluru",
        "Karnataka",
        "560001",
        "India",
        "29ABCDE1234F1Z5",
        "ABCDE1234F",
        "COI-001",
        "Website",
        "",
        "Sample imported lead",
      ],
    ];

    const csv = sample
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "sample-leads-import.csv";

    link.click();

    URL.revokeObjectURL(url);
  };

  const importExcel = async () => {
    if (!excelFile) {
      addToast("Select a file first.", "warning");

      return;
    }

    try {
      setSaving(true);

      const buffer = await excelFile.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
      });

      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("Workbook contains no sheets.");
      }

      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });

      if (!rows.length) {
        throw new Error("File contains no records.");
      }

      let imported = 0;

      for (const rawRow of rows) {
        const row: Record<string, string> = {};

        Object.entries(rawRow).forEach(([key, value]) => {
          row[key.toLowerCase().trim()] = String(value ?? "").trim();
        });

        const get = (...keys: string[]) => {
          for (const key of keys) {
            if (row[key]) {
              return row[key];
            }
          }

          return "";
        };

        const contactName = get(
          "full name",
          "customer name",
          "name",
          "contact name",
        );

        const organizationName = get(
          "organization name",
          "company",
          "organization",
        );

        if (!contactName) {
          continue;
        }

        const importedDetails: LeadDetails = {
          customerType: get("customer type"),

          contactName,

          organizationName,

          website: get("website", "organization website"),

          address: get("address"),

          city: get("city"),

          state: get("state"),

          zipCode: get("pin / zip code", "pin", "zip", "zip code"),


          country: get("country") || "India",

          gstNumber: get("gst number", "gst"),

          panNumber: get("pan number", "pan"),

          coiNumber: get("coi", "coi number"),

          designation: get("designation"),

          mobileNumber: get("mobile", "mobile number", "phone", "phone number"),

          email: get("email"),

          leadSource: get("lead source"),

          remarks: get("remarks"),

          attachments: [],
        };

        const assignedName = get("assigned to");

        const selectedCt = customerTypesList.find(
          (c) => c.name.toLowerCase().trim() === importedDetails.customerType.toLowerCase().trim()
        );
        const selectedSt = statesList.find(
          (s) => s.name.toLowerCase().trim() === importedDetails.state.toLowerCase().trim() || s.code.toLowerCase().trim() === importedDetails.state.toLowerCase().trim()
        );
        const matchingUser = users.find(
          (user) =>
            getUserName(user).toLowerCase().trim() ===
            assignedName.toLowerCase().trim(),
        );

        await createLeadApi({
          title: `${contactName}${
            organizationName ? ` (${organizationName})` : ""
          }`,
          contact_name: contactName,
          organization_name: organizationName || undefined,
          email: importedDetails.email || undefined,
          mobile_number: importedDetails.mobileNumber || undefined,
          website: importedDetails.website || undefined,
          office_address: importedDetails.address || undefined,
          city: importedDetails.city || undefined,
          zip_code: importedDetails.zipCode || undefined,
          country: importedDetails.country || "India",
          gst_number: importedDetails.gstNumber || undefined,
          pan_number: importedDetails.panNumber || undefined,
          coi_number: importedDetails.coiNumber || undefined,
          designation: importedDetails.designation || undefined,
          remarks: importedDetails.remarks || undefined,
          status: "NEW",
          customer_type_id: selectedCt?.id,
          state_id: selectedSt?.id,
          assigned_to_id: matchingUser?.id || undefined,
        });

        imported++;
      }

      addToast(`${imported} lead(s) imported successfully.`, "success");

      setExcelFile(null);
      setShowExcelModal(false);

      if (excelInputRef.current) {
        excelInputRef.current.value = "";
      }

      await fetchLeads();
    } catch (error) {
      console.error(error);

      addToast("Failed to import the file.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------------------------------
     ATTACHMENTS
  -------------------------------------------------------------------------- */

  const addAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const validFiles = files.filter((file) => file.size <= 10 * 1024 * 1024);

    if (validFiles.length !== files.length) {
      addToast("Files above 10MB were ignored.", "warning");
    }

    setForm((previous) => ({
      ...previous,

      attachments: [
        ...previous.attachments,
        ...validFiles.map((file) => file.name),
      ],
    }));

    event.target.value = "";
  };

  /* ==========================================================================
     CREATE / EDIT PAGE
  ========================================================================== */

  if (pageMode === "create" || pageMode === "edit") {
    return (
      <LeadFormPage
        title={pageMode === "create" ? "New Lead" : "Edit Lead"}
        form={form}
        users={users}
        customerTypes={customerTypes}
        states={availableStates}
        saving={saving}
        onChange={updateForm}
        onSubmit={pageMode === "create" ? handleCreateLead : handleUpdateLead}
        onAttachment={addAttachment}
        onClose={closeLeadForm}
      />
    );
  }

  /* ==========================================================================
     LIST PAGE
  ========================================================================== */

  return (
    <div
      className="
        min-h-full
        space-y-5
        pb-8
        select-none
      "
    >
      {/* HEADER */}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Leads
          </h1>

          <button
            type="button"
            title="Refresh Leads"
            onClick={fetchLeads}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300 dark:hover:bg-[#0b2034]"
          >
            <FiRefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div ref={topMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowTopMenu((previous) => !previous)}
            className="
              rounded-xl
              border
              border-slate-200
              bg-white
              p-2
              text-slate-600
              shadow-sm
              hover:bg-slate-50
              dark:border-[#0d2336]
              dark:bg-[#051422]
              dark:text-slate-300
            "
          >
            <FiMoreVertical />
          </button>

          {showTopMenu && (
            <DropdownMenu>
              <DropdownButton icon={<FiDownload />} onClick={exportCSV}>
                Export Data
              </DropdownButton>

              <DropdownButton icon={<FiGrid />} onClick={downloadChart}>
                Download Chart
              </DropdownButton>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* KPI */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Leads" value={totalLeads} change="12%" positive />

        <StatCard label="New" value={newLeads} change="8" positive />

        <StatCard
          label="Qualified"
          value={qualifiedLeads}
          change="5%"
          positive={false}
        />

        <StatCard
          label="Dead"
          value={deadLeads}
          change="5%"
          positive={false}
        />
      </div>

      {/* SEARCH + FILTER + ADD */}

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <FiSearch
            className="
              absolute
              left-4
              top-1/2
              -translate-y-1/2
              text-slate-400
            "
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Leads"
            className="
              h-11
              w-full
              rounded-lg
              border
              border-slate-200
              bg-white
              pl-11
              pr-4
              text-xs
              text-slate-800
              outline-none
              transition
              focus:border-primary
              focus:ring-2
              focus:ring-primary/10
              dark:border-[#0d2336]
              dark:bg-[#051422]
              dark:text-white
            "
          />
        </div>

        {/* FILTER POPOVER */}

        <div
          ref={filterRef}
          className="relative"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={openFilters}
            className="
              relative
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-lg
              border
              border-slate-200
              bg-white
              text-slate-600
              transition
              hover:bg-slate-50
              dark:border-[#17304a]
              dark:bg-[#071929]
              dark:text-slate-300
              dark:hover:bg-[#0b2034]
            "
            aria-label="Filters"
          >
            <FiSliders size={16} />
            {hasActiveFilters && (
              <span
                className="
                  absolute
                  -right-1
                  -top-1
                  flex
                  h-4
                  min-w-4
                  items-center
                  justify-center
                  rounded-full
                  bg-[#233353]
                  px-1
                  text-[9px]
                  font-bold
                  text-white
                "
              >
                {
                  [
                    filters.dateFrom || filters.dateTo,
                    filters.customerType,
                    filters.assignedTo,
                    filters.status !== "all" ? filters.status : "",
                    filters.state,
                  ].filter(Boolean).length
                }
              </span>
            )}
          </button>

          {showFilter && (
            <FilterPopover
              filters={draftFilters}
              users={users}
              customerTypes={customerTypes}
              states={availableStates}
              onChange={(field, value) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  [field]: value,
                }))
              }
              onApply={applyFilters}
              onClear={clearFilters}
            />
          )}
        </div>

        {/* ADD */}

        <div
          ref={addMenuRef}
          className="relative"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setShowAddMenu((previous) => !previous)}
            className="
              flex
              h-11
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-[#233353]
              px-5
              text-xs
              font-bold
              text-white
              shadow-sm
              hover:bg-[#18243a]
              lg:w-auto
            "
          >
            <FiPlus />
            Add New Lead
          </button>

          {showAddMenu && (
            <DropdownMenu className="w-64">
              <DropdownButton
                icon={<FiUserPlus className="text-primary" />}
                onClick={openCreatePage}
              >
                Add Single Lead
              </DropdownButton>

              <DropdownButton
                icon={<FiFileText className="text-emerald-500" />}
                onClick={() => {
                  setShowAddMenu(false);
                  setShowExcelModal(true);
                }}
              >
                Add From Excel
              </DropdownButton>

              <DropdownButton
                icon={<FiLink className="text-indigo-500" />}
                onClick={() => {
                  setShowAddMenu(false);
                  setShowTopMenu(false);

                  if (leads.length > 0) {
                    const lead = leads[0];

                    setDetailsLead(lead);
                    setShowDetailsModal(true);
                  } else {
                    addToast("No lead is available to display.", "warning");
                  }
                }}
              >
                Add From Integration
              </DropdownButton>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ACTIVE FILTER SUMMARY */}

      {hasActiveFilters && (
        <div
          className="
            flex
            flex-wrap
            items-center
            gap-2
            rounded-xl
            border
            border-slate-200
            bg-white
            px-4
            py-3
            dark:border-[#0d2336]
            dark:bg-[#051422]
          "
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Active Filters
          </span>

          {filters.dateFrom || filters.dateTo ? (
            <FilterChip
              label={`Date: ${formatDateInput(filters.dateFrom) || "Any"} - ${
                formatDateInput(filters.dateTo) || "Any"
              }`}
            />
          ) : null}

          {filters.customerType && <FilterChip label={filters.customerType} />}

          {filters.assignedTo && (
            <FilterChip
              label={
                users.find((user) => user.id === filters.assignedTo)
                  ? getUserName(
                      users.find((user) => user.id === filters.assignedTo)!,
                    )
                  : "Assigned"
              }
            />
          )}

          {filters.status !== "all" && (
            <FilterChip
              label={filters.status === "inactive" ? "Inactive" : "Active"}
            />
          )}

          {filters.state && <FilterChip label={filters.state} />}

          <button
            type="button"
            onClick={clearFilters}
            className="
              ml-auto
              flex
              items-center
              gap-1
              text-[10px]
              font-bold
              text-rose-500
            "
          >
            <FiX />
            Clear
          </button>
        </div>
      )}

      {/* TABLE */}

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-slate-200/80
          bg-white
          shadow-sm
          dark:border-[#0d2336]
          dark:bg-[#051422]
        "
      >
        {loading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-slate-400">
            <CgSpinner className="animate-spin text-4xl text-primary" />

            <span className="text-xs font-semibold">Loading leads...</span>
          </div>
        ) : filteredLeads.length === 0 ? (
          <EmptyLeads />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] border-collapse text-left">
                <thead>
                  <tr
                    className="
                      border-b
                      border-slate-200
                      bg-slate-50/70
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-wider
                      text-slate-400
                      dark:border-[#0d2336]
                      dark:bg-[#071929]/60
                    "
                  >
                    <th className="w-12 px-4 py-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Lead ID" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Customer Name" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Company" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Assigned To" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Status" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Created" />
                    </th>

                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-[#0d2336]/70">
                  {paginatedLeads.map((lead) => {
                    /* getLeadDetails reads the real columns first and only
                       falls back to the legacy description blob. Using the
                       parser alone meant email, state and customer type were
                       always blank for rows created through the API. */
                    const details = getLeadDetails(lead);

                    return (
                      <tr
                        key={lead.id}
                        /* The whole row opens the lead, not just the name:
                           that is where a reader's eye and cursor already
                           are. The checkbox and the action cell stop the
                           event so they still work on their own. */
                        onClick={() => openLeadDetails(lead)}
                        className="
                            cursor-pointer
                            transition
                            hover:bg-slate-50
                            dark:hover:bg-[#071929]/50
                          "
                      >
                        <td
                          className="px-4 py-4"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>

                        <td className="px-4 py-4">
                          <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {formatLeadId(lead.id)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {/* Plain markup now the row itself is clickable -
                              a nested button would fire the same handler a
                              second time. */}
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {getLeadDisplayName(lead)}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {details.email || "No email"}
                          </p>

                          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                            <FiMapPin />
                            {formatLeadLocation(details)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {getLeadCompany(lead)}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {getLeadCustomerType(lead)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-[#0d2336] dark:bg-[#071929]">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#233353] text-[9px] font-bold text-white">
                              {getInitials(
                                lead.assigned_to_name || lead.creator_name,
                              )}
                            </span>

                            <span className="max-w-[130px] truncate text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                              {lead.assigned_to_name ||
                                lead.creator_name ||
                                "Unassigned"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            status={lead.status}
                            stage={lead.stage}
                          />
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-[10px] font-medium text-slate-400">
                            {formatDate(lead.created_at)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div
                            className="flex items-center justify-center gap-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {/* The phone icon opened the details drawer,
                                which is now what clicking the row does. */}
                            <div className="relative" data-row-menu>
                              <button
                                type="button"
                                title="More Actions"
                                onClick={() =>
                                  setRowMenuLeadId((previous) =>
                                    previous === lead.id ? null : lead.id,
                                  )
                                }
                                className="
                                    rounded-lg
                                    p-2
                                    text-slate-400
                                    hover:bg-slate-100
                                    hover:text-slate-700
                                    dark:hover:bg-[#071929]
                                    dark:hover:text-white
                                  "
                              >
                                <FiMoreVertical />
                              </button>

                              {rowMenuLeadId === lead.id && (
                                <div
                                  className="
                                      absolute
                                      right-0
                                      top-full
                                      z-40
                                      mt-1
                                      w-52
                                      rounded-xl
                                      border
                                      border-slate-200
                                      bg-white
                                      p-1
                                      shadow-xl
                                      dark:border-[#0d2336]
                                      dark:bg-[#051422]
                                    "
                                >
                                  <RowAction
                                    icon={<FiEdit3 />}
                                    onClick={() => openEditPage(lead)}
                                  >
                                    Edit
                                  </RowAction>

                                  {canAdvanceLead(lead, "CONTACTED") && (
                                    <RowAction
                                      icon={<FiPhoneCall />}
                                      disabled={statusUpdatingId === lead.id}
                                      onClick={() =>
                                        advanceLeadStatus(lead, "CONTACTED")
                                      }
                                    >
                                      Mark as Contacted
                                    </RowAction>
                                  )}

                                  {canAdvanceLead(lead, "QUALIFIED") && (
                                    <RowAction
                                      icon={<FiCheckCircle />}
                                      disabled={statusUpdatingId === lead.id}
                                      onClick={() =>
                                        advanceLeadStatus(lead, "QUALIFIED")
                                      }
                                    >
                                      Mark as Qualified
                                    </RowAction>
                                  )}

                                  {/* Terminal leads have nowhere left to go,
                                      so offering these only produced a 400. */}
                                  {canAdvanceLead(lead, "LOST") && (
                                    <RowAction
                                      icon={<FiXCircle />}
                                      danger
                                      disabled={statusUpdatingId === lead.id}
                                      onClick={() => markLeadDead(lead)}
                                    >
                                      Mark as Dead
                                    </RowAction>
                                  )}

                                  {canAdvanceLead(lead, "CONVERTED") && (
                                    <RowAction
                                      icon={<FiArrowUpRight />}
                                      success
                                      disabled={statusUpdatingId === lead.id}
                                      onClick={() => convertToOpportunity(lead)}
                                    >
                                      Convert to Opportunity
                                    </RowAction>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <Pagination
              page={safeCurrentPage}
              pageSize={PAGE_SIZE}
              totalItems={filteredLeads.length}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              noun="leads"
            />
          </>
        )}
      </div>

      {/* ======================================================================
          EXCEL IMPORT
      ====================================================================== */}

      {showExcelModal && (
        <ExcelImportModal
          file={excelFile}
          saving={saving}
          dragging={isDraggingFile}
          inputRef={excelInputRef}
          onClose={() => {
            if (!saving) {
              setShowExcelModal(false);
              setExcelFile(null);
            }
          }}
          onFile={handleExcelFile}
          onDrop={handleFileDrop}
          onDragEnter={() => setIsDraggingFile(true)}
          onDragLeave={() => setIsDraggingFile(false)}
          onDownloadSample={downloadSampleCSV}
          onImport={importExcel}
        />
      )}

      {/* ======================================================================
          DETAILS
      ====================================================================== */}

      {liveDetailsLead && (
        <LeadDetailsModal
          lead={liveDetailsLead}
          isOpen={showDetailsModal}
          activities={activities}
          activitiesLoading={activitiesLoading}
          saving={statusUpdatingId === liveDetailsLead.id}
          onClose={() => setShowDetailsModal(false)}
          onEdit={() => openEditPage(liveDetailsLead)}
          onMarkDead={() => markLeadDead(liveDetailsLead)}
          onConvert={() => convertToOpportunity(liveDetailsLead)}
          onLogActivity={(payload) => logActivity(liveDetailsLead, payload)}
        />
      )}
    </div>
  );
}

/* ============================================================================
   FILTER POPOVER
============================================================================ */

function FilterPopover({
  filters,
  users,
  customerTypes,
  states,
  onChange,
  onApply,
  onClear,
}: {
  filters: LeadFilters;
  users: User[];
  customerTypes: string[];
  states: string[];
  onChange: <K extends keyof LeadFilters>(
    field: K,
    value: LeadFilters[K],
  ) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className="
        absolute
        right-0
        top-full
        z-50
        mt-3
        w-[520px]
        max-w-[calc(100vw-32px)]
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-2xl
        dark:border-[#0d2336]
        dark:bg-[#051422]
      "
      onClick={(event) => event.stopPropagation()}
    >
      {/* DATE RANGE */}

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-500">
            Date Range
          </label>

          <button
            type="button"
            onClick={() => {
              onChange("dateFrom", "");

              onChange("dateTo", "");
            }}
            className="
              flex
              items-center
              gap-1
              text-[10px]
              font-bold
              text-rose-400
              hover:text-rose-500
            "
          >
            <FiX />
            Clear Filter
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DateFilterInput
            value={filters.dateFrom}
            onChange={(value) => onChange("dateFrom", value)}
          />

          <DateFilterInput
            value={filters.dateTo}
            onChange={(value) => onChange("dateTo", value)}
          />
        </div>
      </div>

      {/* FILTER GRID */}

      <div className="grid grid-cols-2 gap-4">
        <FilterField label="Customer Type">
          <SelectInput
            value={filters.customerType}
            onChange={(value) => onChange("customerType", value)}
            placeholder="All Customer Types"
            options={customerTypes}
          />
        </FilterField>

        <FilterField label="Assigned To">
          <SelectInput
            value={filters.assignedTo}
            onChange={(value) => onChange("assignedTo", value)}
            placeholder="All Users"
            options={users.map((user) => ({
              value: user.id,
              label: getUserName(user),
            }))}
          />
        </FilterField>

        <FilterField label="Status">
          <SelectInput
            value={filters.status}
            onChange={(value) => onChange("status", value)}
            placeholder="All"
            options={[
              {
                value: "all",
                label: "All",
              },
              {
                value: "active",
                label: "Active",
              },
              {
                value: "inactive",
                label: "Inactive",
              },
            ]}
          />
        </FilterField>

        <FilterField label="State">
          <SelectInput
            value={filters.state}
            onChange={(value) => onChange("state", value)}
            placeholder="All"
            options={states}
          />
        </FilterField>
      </div>

      {/* ACTIONS */}

      <div className="mt-5 flex items-center justify-end gap-4 border-t border-slate-100 pt-4 dark:border-[#0d2336]">
        <button
          type="button"
          onClick={onClear}
          className="
            text-xs
            font-bold
            text-slate-500
            hover:text-slate-900
            dark:hover:text-white
          "
        >
          Clear All Filter
        </button>

        <Button onClick={onApply}>Apply Filter</Button>
      </div>
    </div>
  );
}

/* ============================================================================
   NEW LEAD PAGE
============================================================================ */

function LeadFormPage({
  title,
  form,
  users,
  customerTypes,
  states,
  saving,
  onChange,
  onSubmit,
  onAttachment,
  onClose,
}: {
  title: string;
  form: LeadFormState;
  users: User[];
  customerTypes: string[];
  states: string[];
  saving: boolean;
  onChange: <K extends keyof LeadFormState>(
    field: K,
    value: LeadFormState[K],
  ) => void;
  onSubmit: (event: FormEvent) => void;
  onAttachment: (event: ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="min-h-full pb-8">
      {/* PAGE HEADER */}

      <FormPageHeader
        title={title}
        parentLabel="Leads"
        currentLabel={title === "Edit Lead" ? "Edit" : "New"}
        actions={
          <>
            <CancelButton onClick={onClose} />

            <DraftButton disabled={saving} onClick={onClose} />

            <SubmitButton formId="lead-form" disabled={saving}>
              {saving
                ? "Creating..."
                : title === "Edit Lead"
                  ? "Save Lead"
                  : "Create Lead"}
            </SubmitButton>
          </>
        }
      />

      <form
        id="lead-form"
        onSubmit={onSubmit}
        className="
    grid
    grid-cols-1
    gap-4
    xl:grid-cols-[minmax(0,1fr)_360px]
  "
      >
        {/* LEFT */}

        <FormCard>
          <FormSectionBlock first icon={<FiInfo />} title="Customer Information">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FormSelect
                  label="Customer Type"
                  required
                  value={form.customerType}
                  onChange={(value) => onChange("customerType", value)}
                  options={customerTypes}
                />
              </div>

              <FormInput
                label="Organization Name"
                required
                value={form.organizationName}
                onChange={(value) => onChange("organizationName", value)}
              />

              <FormInput
                label="Organization Website"
                required
                value={form.website}
                placeholder="www.company.com"
                onChange={(value) => onChange("website", value)}
              />
            </div>
          </FormSectionBlock>

          <FormSectionBlock icon={<FiMapPin />} title="Organization Details">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormInput
                  label="Street Address"
                  required
                  value={form.address}
                  placeholder="Street Address, Building, Suite"
                  onChange={(value) => onChange("address", value)}
                />

                <FormSelect
                  label="State / Province"
                  required
                  value={form.state}
                  onChange={(value) => onChange("state", value)}
                  options={states}
                  allowCustom
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormInput
                  label="City"
                  required
                  value={form.city}
                  placeholder="Type or select"
                  onChange={(value) => onChange("city", value)}
                />

                <FormSelect
                  label="Country"
                  required
                  value={form.country}
                  onChange={(value) => onChange("country", value)}
                  options={COUNTRIES}
                />
              </div>

              <FormInput
                label="PIN / ZIP Code"
                required
                value={form.zipCode}
                placeholder="Pin Code"
                onChange={(value) => onChange("zipCode", value)}
              />
            </div>
          </FormSectionBlock>

          <FormSectionBlock icon={<FiShield />} title="Registration & Compliance">
            <div className="space-y-4">
              <DocumentField
                label="GST Number"
                value={form.gstNumber}
                onChange={(value) => onChange("gstNumber", value)}
                onFile={onAttachment}
              />

              <DocumentField
                label="PAN Number"
                value={form.panNumber}
                onChange={(value) => onChange("panNumber", value)}
                onFile={onAttachment}
              />

              <DocumentField
                label="COI (Certificate of Incorporation)"
                value={form.coiNumber}
                onChange={(value) => onChange("coiNumber", value)}
                onFile={onAttachment}
              />
            </div>
          </FormSectionBlock>

          <FormSectionBlock icon={<FiUser />} title="Primary Contact">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Full Name"
                required
                value={form.contactName}
                onChange={(value) => onChange("contactName", value)}
              />

              <FormInput
                label="Designation"
                required
                value={form.designation}
                placeholder="e.g. Procurement Manager"
                onChange={(value) => onChange("designation", value)}
              />

              <FormInput
                label="Mobile Number"
                required
                value={form.mobileNumber}
                placeholder="XXXXXXXXXX"
                onChange={(value) => onChange("mobileNumber", value)}
              />

              <FormInput
                label="Email Address"
                required
                type="email"
                value={form.email}
                onChange={(value) => onChange("email", value)}
              />
            </div>
          </FormSectionBlock>
        </FormCard>

        {/* RIGHT */}

        <FormCard className="h-fit">
          <FormSectionBlock first icon={<FiBriefcase />} title="Sales Information">
            <div className="space-y-4">
              <FormSelect
                label="Lead Source"
                required
                value={form.leadSource}
                onChange={(value) => onChange("leadSource", value)}
                options={LEAD_SOURCES}
              />

              <UserSelect
                label="Assigned To"
                required
                value={form.assignedToId}
                users={users}
                onChange={(value) => onChange("assignedToId", value)}
              />
            </div>
          </FormSectionBlock>

          <FormSectionBlock icon={<FiFileText />} title="Requirements & Files">
            <div className="space-y-5">
              {/* Remarks */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Remarks
                </label>

                <textarea
                  rows={6}
                  value={form.remarks}
                  onChange={(event) => onChange("remarks", event.target.value)}
                  placeholder="Enter specific hardware requirements or customization requests..."
                  className="
                    w-full
                    resize-none
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50/70
                    p-3
                    text-xs
                    text-slate-800
                    outline-none
                    transition
                    focus:border-primary
                    focus:ring-2
                    focus:ring-primary/20
                    dark:border-[#0d2336]
                    dark:bg-[#071929]
                    dark:text-white
                  "
                />
              </div>

              {/* Attachments Heading */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Attachments
                </label>

                {/* Upload Area */}
                <label
                  className="
                    flex
                    min-h-[150px]
                    w-full
                    cursor-pointer
                    flex-col
                    items-center
                    justify-center
                    rounded-2xl
                    border-2
                    border-dashed
                    border-slate-200
                    p-5
                    text-center
                    transition
                    hover:bg-slate-50
                    dark:border-[#0d2336]
                    dark:hover:bg-[#071929]
                  "
                >
                  <FiPaperclip className="mb-3 text-2xl text-slate-400" />

                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Drop files or click to upload
                  </span>

                  <span className="mt-1 text-[10px] text-slate-400">
                    PDF, DOC, XLS up to 10MB
                  </span>

                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onAttachment}
                  />
                </label>
              </div>

              {/* Selected Attachments */}
              {form.attachments.length > 0 && (
                <div className="space-y-2">
                  {form.attachments.map((attachment, index) => (
                    <div
                      key={`${attachment}-${index}`}
                      className="
                flex
                items-center
                gap-2
                rounded-lg
                bg-slate-50
                px-3
                py-2
                text-[10px]
                font-semibold
                text-slate-500
                dark:bg-[#071929]
              "
                    >
                      <FiCheckCircle className="shrink-0 text-emerald-500" />

                      <span className="truncate">{attachment}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormSectionBlock>
        </FormCard>
      </form>
    </div>
  );
}

/* ============================================================================
   EXCEL IMPORT MODAL
============================================================================ */

function ExcelImportModal({
  file,
  saving,
  dragging,
  inputRef,
  onClose,
  onFile,
  onDrop,
  onDragEnter,
  onDragLeave,
  onDownloadSample,
  onImport,
}: {
  file: File | null;
  saving: boolean;
  dragging: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDownloadSample: () => void;
  onImport: () => void;
}) {
  return (
    <Modal isOpen onClose={onClose} title="Upload a CSV File" size="lg">
      <div className="space-y-5">
        {/* Upload Box */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={(event) => {
            event.preventDefault();
            onDragEnter();
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            onDragLeave();
          }}
          className={`
            flex
            min-h-[116px]
            w-full
            cursor-pointer
            flex-col
            items-center
            justify-center
            rounded-xl
            border
            border-dashed
            px-6
            py-6
            text-center
            transition-all
            duration-200

            ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-slate-300 bg-white hover:bg-slate-50"
            }

            dark:border-[#0d2336]
            dark:bg-[#051422]
            dark:hover:bg-[#071929]
          `}
        >
          <FiUploadCloud
            className={`
              text-2xl
              transition-colors
              ${dragging ? "text-primary" : "text-slate-400"}
            `}
          />

          <p className="mt-3 text-xs text-slate-600 dark:text-slate-200">
            Drag and drop your file here, or{" "}
            <span
              className="font-semibold text-blue-500 hover:text-blue-600"
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Browse
            </span>
          </p>

          <p className="mt-1 text-[10px] text-slate-400">
            Supported formats: .xlsx, .xls, .csv • Max file size: 10 MB
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={onFile}
          />
        </div>

        {/* Selected File */}
        {file && (
          <div
            className="
              flex
              items-center
              justify-between
              rounded-lg
              border
              border-emerald-200
              bg-emerald-50
              px-3
              py-2.5
              dark:border-emerald-900/40
              dark:bg-emerald-950/20
            "
          >
            <div className="flex min-w-0 items-center gap-2">
              <FiCheckCircle className="shrink-0 text-emerald-500" />

              <span
                className="
                  truncate
                  text-xs
                  font-semibold
                  text-emerald-700
                  dark:text-emerald-400
                "
              >
                {file.name}
              </span>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();

                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
              className="
                shrink-0
                rounded-md
                p-1
                text-slate-400
                transition-colors
                hover:bg-white
                hover:text-rose-500
                dark:hover:bg-[#071929]
              "
            >
              <FiX className="text-sm" />
            </button>
          </div>
        )}

        {/* Sample CSV */}
        <button
          type="button"
          onClick={onDownloadSample}
          className="
            text-xs
            font-semibold
            text-slate-600
            underline
            underline-offset-2
            transition-colors
            hover:text-primary
            dark:text-slate-300
          "
        >
          Download a sample CSV file
        </button>

        {/* Footer */}
        <div
          className="
            flex
            justify-end
            gap-3
            border-t
            border-slate-100
            pt-4
            dark:border-[#0d2336]
          "
        >
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button type="button" disabled={!file || saving} onClick={onImport}>
            {saving ? (
              <span className="flex items-center gap-2">
                <CgSpinner className="animate-spin" />
                Importing...
              </span>
            ) : (
              "Import Leads"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================================
   LEAD DETAILS MODAL
============================================================================ */

function LeadDetailsModal({
  lead,
  isOpen,
  activities,
  activitiesLoading,
  saving,
  onClose,
  onEdit,
  onMarkDead,
  onConvert,
  onLogActivity,
}: {
  lead: Lead;
  isOpen: boolean;
  activities: LeadActivity[];
  activitiesLoading: boolean;
  saving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMarkDead: () => void;
  onConvert: () => void;
  onLogActivity: (payload: LogLeadActivityPayload) => Promise<boolean>;
}) {
  const details = getLeadDetails(lead);

  const [showActivityForm, setShowActivityForm] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowActivityForm(false);
    }
  }, [isOpen]);

  /* A different lead in the same drawer starts with a closed form, so a
     half-written note never carries over to somebody else's record. */
  useEffect(() => {
    setShowActivityForm(false);
  }, [lead.id]);

  if (!isOpen) return null;

  const isDead = lead.status === "LOST" || lead.stage === "dead";
  /* Index of this lead along the canonical NEW -> CONVERTED path.
     LOST is a terminal outcome shown in its own cell, not a step. */
  const pipelineIndex = LEAD_PIPELINE.findIndex(
    (step) => step.status === lead.status,
  );

  return (
    <div className="fixed inset-0 z-[100]">
      {/* BACKDROP */}

      <button
        type="button"
        aria-label="Close lead details"
        onClick={onClose}
        className="
          absolute
          inset-0
          bg-slate-950/45
          backdrop-blur-[2px]
        "
      />

      {/* DRAWER */}

      <aside
        className="
          absolute
          right-0
          top-0
          flex
          h-full
          w-full
          max-w-[700px]
          flex-col
          bg-white
          shadow-2xl
          dark:bg-[#051422]
        "
      >
        {/* HEADER */}

        <div
          className="
            flex
            h-[76px]
            shrink-0
            items-center
            justify-between
            border-b
            border-slate-200
            px-6
            dark:border-[#0d2336]
          "
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="
                rounded-lg
                p-1
                text-slate-500
                transition
                hover:bg-slate-100
                hover:text-slate-800
                dark:hover:bg-[#071929]
              "
            >
              <FiX className="text-xl" />
            </button>

            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Lead Details
            </h2>
          </div>

          <button
            type="button"
            onClick={onConvert}
            disabled={lead.status !== "QUALIFIED"}
            className="
              rounded-lg
              bg-[#1d2b45]
              px-4
              py-2.5
              text-xs
              font-bold
              text-white
              transition
              hover:bg-[#162238]
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            Convert To Opportunity
          </button>
        </div>

        {/* STATUS PIPELINE */}

        <div
          className="
            grid
            shrink-0
            grid-cols-5
            border-b
            border-slate-200
            dark:border-[#0d2336]
          "
        >
          {LEAD_PIPELINE.map((step, index) => (
            <LeadStage
              key={step.status}
              label={step.label}
              active={!isDead && index === pipelineIndex}
              completed={!isDead && pipelineIndex > -1 && index < pipelineIndex}
              first={index === 0}
            />
          ))}

          <LeadStage label="Lost" active={isDead} completed={false} />
        </div>

        {/* CONTENT */}

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* LEAD HEADER */}

            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {/* AVATAR */}

                <div
                  className="
                    relative
                    flex
                    h-20
                    w-20
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-full
                    bg-slate-200
                    text-xl
                    font-bold
                    text-slate-500
                    dark:bg-[#0d2336]
                  "
                >
                  {getInitials(details.contactName || lead.title)}

                  <span
                    className="
                      absolute
                      bottom-1
                      right-1
                      h-5
                      w-5
                      rounded-full
                      border-2
                      border-white
                      bg-emerald-500
                      dark:border-[#051422]
                    "
                  />
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-xl font-semibold text-slate-900 dark:text-white">
                    {details.contactName || getLeadDisplayName(lead)}
                  </h3>

                  <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                    {details.designation || "Lead"}{" "}
                    {details.organizationName
                      ? `@ ${details.organizationName}`
                      : ""}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    {details.email && (
                      <span className="flex items-center gap-1">
                        <FiMail />
                        {details.email}
                      </span>
                    )}

                    {details.mobileNumber && (
                      <span className="flex items-center gap-1">
                        <FiPhone />
                        {details.mobileNumber}
                      </span>
                    )}
                  </div>

                  {(details.state || details.city) && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                      <FiMapPin />
                      {details.city
                        ? `${details.city}${
                            details.state ? `, ${details.state}` : ""
                          }`
                        : details.state}
                    </p>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS */}

              {/* The three-dot menu that sat here is gone: Edit Lead and
                  Mark Dead are in the footer, and the remaining status moves
                  belong to the Log Activity form, which also captures why
                  the lead moved. */}
              <div className="relative flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    text-slate-600
                    shadow-sm
                    hover:bg-slate-50
                    dark:border-[#0d2336]
                    dark:bg-[#071929]
                    dark:text-slate-300
                  "
                >
                  <FiMessageSquare />
                </button>

              </div>
            </div>

            {/* ACTIVITY HISTORY */}

            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Activity History
                </h3>

                <button
                  type="button"
                  onClick={() => setShowActivityForm((value) => !value)}
                  className="
                    text-[11px]
                    font-medium
                    text-slate-500
                    hover:text-primary
                    dark:text-slate-400
                  "
                >
                  {showActivityForm ? "Cancel" : "+ Log Activity"}
                </button>
              </div>

              {showActivityForm && (
                <LogActivityForm
                  lead={lead}
                  saving={saving}
                  onCancel={() => setShowActivityForm(false)}
                  onSubmit={async (payload) => {
                    const ok = await onLogActivity(payload);

                    if (ok) {
                      setShowActivityForm(false);
                    }

                    return ok;
                  }}
                />
              )}

              <div className="relative pl-5">
                {/* TIMELINE */}

                <div
                  className="
                    absolute
                    bottom-1
                    left-[4px]
                    top-1
                    w-px
                    bg-slate-200
                    dark:bg-[#0d2336]
                  "
                />

                {activitiesLoading ? (
                  <div className="flex items-center gap-2 py-6 text-[11px] font-semibold text-slate-400">
                    <CgSpinner className="animate-spin text-base" />
                    Loading activity...
                  </div>
                ) : activities.length ? (
                  <div className="space-y-5">
                    {activities.map((activity, index) => (
                      <ActivityTimelineCard
                        key={activity.id || `${activity.created_at}-${index}`}
                        title={activity.action}
                        description={activity.description}
                        date={activity.created_at}
                        author={activity.created_by_name}
                        active={index === 0}
                      />
                    ))}
                  </div>
                ) : (
                  /* Only reached for a lead raised before the history table
                     existed and never touched since. */
                  <div className="space-y-5">
                    <ActivityTimelineCard
                      title="Lead Created"
                      description={
                        details.remarks || "Lead was registered in the CRM."
                      }
                      date={lead.created_at}
                      active
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}

        <div
          className="
            flex
            shrink-0
            items-center
            gap-3
            border-t
            border-slate-200
            bg-white
            px-6
            py-4
            dark:border-[#0d2336]
            dark:bg-[#051422]
          "
        >
          <button
            type="button"
            onClick={onEdit}
            className="
              flex
              flex-1
              items-center
              justify-center
              gap-2
              rounded-lg
              border
              border-slate-200
              bg-white
              py-3
              text-xs
              font-bold
              text-slate-700
              transition
              hover:bg-slate-50
              dark:border-[#0d2336]
              dark:bg-[#071929]
              dark:text-slate-200
              dark:hover:bg-[#0b2034]
            "
          >
            <FiEdit3 />
            Edit Lead
          </button>

          <button
            type="button"
            onClick={onMarkDead}
            disabled={saving || !canAdvanceLead(lead, "LOST")}
            className="
              flex
              flex-1
              items-center
              justify-center
              gap-2
              rounded-lg
              border
              border-rose-200
              bg-white
              py-3
              text-xs
              font-bold
              text-rose-500
              transition
              hover:bg-rose-50
              disabled:cursor-not-allowed
              disabled:opacity-40
              dark:border-rose-900/40
              dark:bg-[#071929]
              dark:hover:bg-rose-950/20
            "
          >
            <FiXCircle />
            Mark Dead
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================================
   LOG ACTIVITY FORM
============================================================================ */

/* Opens under the Activity History heading. Status and remarks are submitted
   together so the timeline records why a lead moved, not just that it did. */
function LogActivityForm({
  lead,
  saving,
  onCancel,
  onSubmit,
}: {
  lead: Lead;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: LogLeadActivityPayload) => Promise<boolean>;
}) {
  const leadId = lead.id;
  const leadStatus = lead.status;

  const nextStatuses = logActivityStatuses(leadStatus);

  /* Default to the step forward rather than to "no change": moving the lead
     on is what this form is opened for most of the time. */
  const [status, setStatus] = useState(nextStatuses[0] || "");
  const [remarks, setRemarks] = useState("");

  /* Reset once the lead moves, so the select is never left offering a step
     that has already been taken. */
  useEffect(() => {
    setStatus(logActivityStatuses(leadStatus)[0] || "");
    setRemarks("");
  }, [leadId, leadStatus]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const ok = await onSubmit({
      status: status || undefined,
      remarks: remarks.trim() || undefined,
    });

    if (ok) {
      setRemarks("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="
        mb-5
        rounded-xl
        border
        border-slate-200
        bg-slate-50/70
        p-4
        dark:border-[#0d2336]
        dark:bg-[#071929]
      "
    >
      <div className="mb-3">
        <label className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          Move Status To
        </label>

        <div className="relative">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="
              h-10
              w-full
              appearance-none
              rounded-lg
              border
              border-slate-200
              bg-white
              px-3
              pr-9
              text-xs
              text-slate-700
              outline-none
              focus:border-primary
              focus:ring-2
              focus:ring-primary/10
              dark:border-[#0d2336]
              dark:bg-[#051422]
              dark:text-white
            "
          >
            {/* Always available, so the form can also be used to record a
                call or a note without moving the lead on. */}
            <option value="">Keep as {leadStatusLabel(lead.status)}</option>

            {nextStatuses.map((next) => (
              <option key={next} value={next}>
                {leadStatusLabel(next)}
              </option>
            ))}
          </select>

          <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        {!nextStatuses.length && (
          <p className="mt-1.5 text-[10px] text-slate-400">
            This lead is {leadStatusLabel(lead.status)} and cannot move
            further. You can still log a note against it.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          Remarks
        </label>

        <textarea
          rows={3}
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          placeholder="What happened? e.g. Discussed technical specs and power requirements."
          className="
            w-full
            resize-none
            rounded-lg
            border
            border-slate-200
            bg-white
            p-3
            text-xs
            text-slate-800
            outline-none
            focus:border-primary
            focus:ring-2
            focus:ring-primary/10
            dark:border-[#0d2336]
            dark:bg-[#051422]
            dark:text-white
          "
        />
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="
            rounded-lg
            px-3
            py-2
            text-[11px]
            font-bold
            text-slate-500
            hover:text-slate-800
            dark:hover:text-white
          "
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving || (!status && !remarks.trim())}
          className="
            flex
            items-center
            gap-2
            rounded-lg
            bg-[#1d2b45]
            px-4
            py-2
            text-[11px]
            font-bold
            text-white
            transition
            hover:bg-[#162238]
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
        >
          {saving && <CgSpinner className="animate-spin" />}
          {saving ? "Saving..." : "Submit"}
        </button>
      </div>
    </form>
  );
}

function LeadStage({
  label,
  active,
  completed,
  first,
}: {
  label: string;
  active?: boolean;
  completed?: boolean;
  first?: boolean;
}) {
  return (
    <div
      className={`
        flex
        h-8
        items-center
        justify-center
        gap-1.5
        border-r
        border-slate-200
        text-[10px]
        font-medium
        dark:border-[#0d2336]
        ${
          active
            ? "bg-amber-50 text-slate-700 dark:bg-amber-950/20 dark:text-slate-200"
            : completed
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
              : "bg-white text-slate-500 dark:bg-[#051422] dark:text-slate-400"
        }
        ${first ? "" : ""}
      `}
    >
      <span
        className={`
          flex
          h-3
          w-3
          items-center
          justify-center
          rounded-full
          border
          text-[7px]
          ${
            completed
              ? "border-emerald-500 bg-emerald-500 text-white"
              : active
                ? "border-amber-500 text-amber-500"
                : "border-slate-300 text-slate-400 dark:border-slate-600"
          }
        `}
      >
        {completed ? "✓" : ""}
      </span>

      {label}
    </div>
  );
}

function ActivityTimelineCard({
  title,
  description,
  date,
  author,
  active = false,
}: {
  title: string;
  description?: string;
  date?: string;
  author?: string | null;
  active?: boolean;
}) {
  return (
    <div className="relative">
      {/* TIMELINE DOT */}

      <span
        className={`
          absolute
          -left-[25px]
          top-2
          h-2.5
          w-2.5
          rounded-full
          border-2
          border-white
          dark:border-[#051422]
          ${active ? "bg-[#1d2b45]" : "bg-slate-200 dark:bg-slate-600"}
        `}
      />

      {/* CARD */}

      <div
        className="
          rounded-xl
          border
          border-slate-200
          bg-white
          px-4
          py-3
          shadow-sm
          dark:border-[#0d2336]
          dark:bg-[#071929]
        "
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold text-slate-800 dark:text-white">
            {title}
          </p>

          <span className="shrink-0 text-[9px] text-slate-400">
            {formatActivityStamp(date)}
          </span>
        </div>

        {description && (
          <p className="mt-1.5 max-w-[90%] text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}

        {date && (
          <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400">
            <FiCalendar />
            {formatActivityDateTime(date)}
            {author ? ` • ${author}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   UI COMPONENTS
============================================================================ */

function StatusBadge({ status, stage }: { status: string; stage: string }) {
  /* Leads carry a legacy `stage` alongside the canonical status; fall back to
     it so older rows still render, then let the shared pill pick the colour so
     the badge matches Opportunity and Sales Order. */
  const canonical =
    status ||
    (stage === "dead"
      ? "LOST"
      : stage === "opportunity" || stage === "quotation"
        ? "CONVERTED"
        : "NEW");

  return <StatusPill status={canonical} />;
}
function TableHeader({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      {label}

      <span className="flex flex-col leading-[6px] text-slate-300">
        <span>⌃</span>
        <span>⌄</span>
      </span>
    </span>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 dark:bg-[#071929] dark:text-slate-300">
      {label}
    </span>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-500">
        {label}
      </label>

      {children}
    </div>
  );
}

function DateFilterInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="
          h-11
          w-full
          rounded-xl
          border
          border-slate-200
          bg-white
          pl-10
          pr-3
          text-xs
          text-slate-700
          outline-none
          focus:border-primary
          focus:ring-2
          focus:ring-primary/10
          dark:border-[#0d2336]
          dark:bg-[#071929]
          dark:text-white
        "
      />
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<
    | string
    | {
        value: string;
        label: string;
      }
  >;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="
          h-11
          w-full
          appearance-none
          rounded-xl
          border
          border-slate-200
          bg-white
          px-3
          pr-9
          text-xs
          text-slate-700
          outline-none
          focus:border-primary
          focus:ring-2
          focus:ring-primary/10
          dark:border-[#0d2336]
          dark:bg-[#071929]
          dark:text-white
        "
      >
        <option value="">{placeholder}</option>

        {options.map((option) => {
          const item =
            typeof option === "string"
              ? {
                  value: option,
                  label: option,
                }
              : option;

          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>

      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

const filterInput = `
  w-full
  rounded-xl
  border
  border-slate-200
  bg-slate-50/70
  px-3.5
  py-2.5
  text-xs
  text-slate-800
  outline-none
  focus:ring-2
  focus:ring-primary/30
  dark:border-[#0d2336]
  dark:bg-[#071929]
  dark:text-white
`;

function FormInput({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}

        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>

      <Input
        type={type}
        value={value}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  required,
  allowCustom = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  allowCustom?: boolean;
}) {
  const isCustom = allowCustom && value && !options.includes(value);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}

        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>

      <div className="relative">
        <select
          value={isCustom ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          className={`
            ${filterInput}
            appearance-none
            pr-9
          `}
        >
          <option value="">Select {label}</option>

          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {/* {allowCustom && (
        <input
          value={isCustom ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Or enter custom state"
          className={`
            ${filterInput}
            mt-2
          `}
        />
      )} */}
    </div>
  );
}

function UserSelect({
  label,
  value,
  users,
  onChange,
  required,
}: {
  label: string;
  value: string;
  users: User[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}

        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="
            w-full
            appearance-none
            rounded-xl
            border
            border-slate-200
            bg-slate-50/70
            px-3
            py-2.5
            pr-9
            text-xs
            outline-none
            focus:ring-2
            focus:ring-primary/30
            dark:border-[#0d2336]
            dark:bg-[#071929]
            dark:text-white
          "
        >
          <option value="">Select Assigned To</option>

          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {getUserName(user)}
            </option>
          ))}
        </select>

        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function DocumentField({
  label,
  value,
  onChange,
  onFile,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}
      </label>

      <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-3">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Enter ${label}`}
        />

        <label
          className="
            flex
            cursor-pointer
            items-center
            justify-center
            gap-1.5
            rounded-xl
            border-2
            border-dashed
            border-slate-200
            px-3
            text-[10px]
            font-bold
            text-slate-500
            hover:bg-slate-50
            dark:border-[#0d2336]
            dark:hover:bg-[#071929]
          "
        >
          <FiUploadCloud />
          Upload Doc
          <input type="file" className="hidden" onChange={onFile} />
        </label>
      </div>
    </div>
  );
}

function DropdownMenu({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`
        absolute
        right-0
        top-full
        z-50
        mt-2
        w-52
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-1.5
        shadow-2xl
        dark:border-[#0d2336]
        dark:bg-[#051422]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

function DropdownButton({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        flex
        w-full
        items-center
        gap-3
        rounded-xl
        px-3
        py-2.5
        text-left
        text-xs
        font-semibold
        text-slate-700
        hover:bg-slate-100
        dark:text-slate-200
        dark:hover:bg-[#071929]
      "
    >
      {icon}
      {children}
    </button>
  );
}

function RowAction({
  icon,
  children,
  onClick,
  danger,
  success,
  disabled,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  success?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex
        w-full
        items-center
        gap-2
        rounded-lg
        px-3
        py-2
        text-left
        text-xs
        font-semibold
        hover:bg-slate-100
        disabled:cursor-not-allowed
        disabled:opacity-40
        dark:hover:bg-[#071929]
        ${
          danger
            ? "text-rose-500"
            : success
              ? "text-emerald-600"
              : "text-slate-700 dark:text-slate-200"
        }
      `}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyLeads() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
      <div
        className="
          rounded-2xl
          bg-slate-100
          p-4
          text-slate-400
          dark:bg-[#071929]
        "
      >
        <FiUser className="text-3xl" />
      </div>

      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
        No Leads Found
      </p>

      <p className="text-xs text-slate-400">
        Try changing your search or filters.
      </p>
    </div>
  );
}
