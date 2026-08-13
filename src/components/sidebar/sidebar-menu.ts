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
  children?: Array<{
    title: string;
    icon: IconType;
    path: string;
  }>;
}

export const sidebarMenu: SidebarItemConfig[] = [
  {
    title: "Dashboard",
    icon: LuLayoutGrid,
    path: "/dashboard",
  },
  {
    title: "Customers",
    icon: LuContact,
    path: "/sales/customers",
  },
  {
    title: "Sales",
    icon: LuMegaphone,
    children: [
      {
        title: "Leads",
        icon: LuUser,
        path: "/leads",
      },
      {
        title: "Oppurtunity",
        icon: LuStar,
        path: "/sales/opportunities",
      },
    ],
  },
  {
    title: "Accounts",
    icon: LuUsers,
    path: "/users",
  },
  {
    title: "Inventory",
    icon: LuPackage,
    path: "/inventory",
  },
  {
    title: "Sales Orders",
    icon: LuFileText,
    path: "/sales/orders",
  },
  {
    title: "Reports",
    icon: LuTrendingUp,
    path: "/dashboard",
  },
  {
    title: "Masters",
    icon: LuDatabase,
    children: [
      {
        title: "Companies",
        icon: LuBuilding,
        path: "/companies",
      },
      {
        title: "Locations",
        icon: LuMapPin,
        path: "/locations",
      },
      {
        title: "Customer Type",
        icon: LuTag,
        path: "/customer-types",
      },
      {
        title: "Product Type",
        icon: LuBoxes,
        path: "/product-types",
      },
      {
        title: "Category Group",
        icon: LuLayers,
        path: "/category-groups",
      },
      {
        title: "Units",
        icon: LuList,
        path: "/units",
      },
      {
        title: "Roles & Access",
        icon: LuShieldCheck,
        path: "/rbac",
      },
    ],
  },
  {
    title: "Workflows",
    icon: LuGitBranch,
    path: "/workflows",
  },
];