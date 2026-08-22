import {
  LuLayoutGrid,
  LuContact,
  LuMegaphone,
  LuUser,
  LuStar,
  LuUsers,
  LuPackage,
  LuFileText,
  LuTrendingUp,
  LuDatabase,
  LuBuilding,
  LuMapPin,
  LuTag,
  LuBoxes,
  LuLayers,
  LuList,
  LuGitBranch,
  LuShieldCheck,
} from "react-icons/lu";
import { IconType } from "react-icons";

export interface SidebarItemConfig {
  title: string;
  icon: IconType;
  path?: string;
  permission?: string;
  children?: Array<{
    title: string;
    icon: IconType;
    path: string;
    permission: string;
  }>;
}

export const sidebarMenu: SidebarItemConfig[] = [
  {
    title: "Dashboard",
    icon: LuLayoutGrid,
    path: "/dashboard",
    permission: "dashboard.read",
  },
  {
    title: "Customers",
    icon: LuContact,
    path: "/sales/customers",
    permission: "customer.read",
  },
  {
    title: "Sales",
    icon: LuMegaphone,
    permission: "sales.menu",
    children: [
      {
        title: "Leads",
        icon: LuUser,
        path: "/leads",
        permission: "lead.read",
      },
      {
        title: "Oppurtunity",
        icon: LuStar,
        path: "/sales/opportunities",
        permission: "opportunity.read",
      },
      {
        title: "Sales Orders",
        icon: LuFileText,
        path: "/sales/orders",
        permission: "order.read",
      },
    ],
  },
  {
    title: "Accounts",
    icon: LuUsers,
    path: "/users",
    permission: "user.read",
  },
  {
    title: "Inventory",
    icon: LuPackage,
    path: "/inventory",
    permission: "inventory.read",
  },
  {
    title: "Sales Orders",
    icon: LuFileText,
    path: "/sales/orders",
    permission: "order.read",
  },
  {
    title: "Reports",
    icon: LuTrendingUp,
    path: "/dashboard",
    permission: "reports.read",
  },
  {
    title: "Masters",
    icon: LuDatabase,
    permission: "masters.menu",
    children: [
      {
        title: "Companies",
        icon: LuBuilding,
        path: "/companies",
        permission: "company.read",
      },
      {
        title: "Locations",
        icon: LuMapPin,
        path: "/locations",
        permission: "location.read",
      },
      {
        title: "Customer Type",
        icon: LuTag,
        path: "/customer-types",
        permission: "customer_type.read",
      },
      {
        title: "Product Type",
        icon: LuBoxes,
        path: "/product-types",
        permission: "product_type.read",
      },
      {
        title: "Category Group",
        icon: LuLayers,
        path: "/category-groups",
        permission: "category_group.read",
      },
      {
        title: "Units",
        icon: LuList,
        path: "/units",
        permission: "unit.read",
      },
      {
        title: "Roles & Access",
        icon: LuShieldCheck,
        path: "/rbac",
        permission: "role.read",
      },
    ],
  },
  {
    title: "Workflows",
    icon: LuGitBranch,
    path: "/workflows",
    permission: "workflow.read",
  },
];