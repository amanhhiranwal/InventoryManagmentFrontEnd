import {
  FaUsers,
  FaUserPlus,
  FaList,
  FaHome,
  FaBuilding,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaSitemap,
  FaLightbulb,
  FaDatabase,
  FaUserTag,
  FaBoxes,
  FaTag,
  FaChartLine,
  FaUserFriends,
  FaBullseye,
} from "react-icons/fa";

export const sidebarMenu = [
  {
    title: "Dashboard",
    icon: FaHome,
    path: "/dashboard",
  },

  {
    title: "Users",
    icon: FaUsers,
    children: [
      {
        title: "User List",
        icon: FaList,
        path: "/users",
      },
      {
        title: "Add User",
        icon: FaUserPlus,
        path: "/users/add",
      },
    ],
  },

  {
    title: "Masters",
    icon: FaDatabase,
    children: [
      {
        title: "Companies",
        icon: FaBuilding,
        path: "/companies",
      },
      {
        title: "Locations",
        icon: FaMapMarkerAlt,
        path: "/locations",
      },
      {
        title: "Customer Type",
        icon: FaUserTag,
        path: "/customer-types",
      },
      {
        title: "Product Type",
        icon: FaBoxes,
        path: "/product-types",
      },
      {
        title: "Category Group",
        icon: FaTag,
        path: "/category-groups",
      },
    ],
  },

  {
    title: "Roles & Permissions",
    icon: FaShieldAlt,
    path: "/rbac",
  },

  {
    title: "Workflows",
    icon: FaSitemap,
    path: "/workflows",
  },

  {
    title: "Sales",
    icon: FaChartLine,
    children: [
      {
        title: "Customer",
        icon: FaUserFriends,
        path: "/sales/customers",
      },
      {
        title: "Lead",
        icon: FaLightbulb,
        path: "/leads",
      },
      {
        title: "Opportunity",
        icon: FaBullseye,
        path: "/sales/opportunities",
      },
    ],
  },

  {
    title: "Inventory",
    icon: FaBoxes,
    path: "/inventory",
  },
];