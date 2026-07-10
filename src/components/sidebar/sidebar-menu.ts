import {
  FaUsers,
  FaUserPlus,
  FaList,
  FaHome,
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
];