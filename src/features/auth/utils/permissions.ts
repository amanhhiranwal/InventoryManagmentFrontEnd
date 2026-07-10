// import { useAuthStore } from "../store/auth.store";

// export const hasPermission = (permissionId: string) => {
//   const user = useAuthStore.getState().user;

//   if (!user) return false;

//   return (
//     user.permissions?.some((permission) => permission.id === permissionId) ??
//     false
//   );
// };

// export const hasRole = (roleId: string) => {
//   const user = useAuthStore.getState().user;

//   return user?.role_id === roleId;
// };

import { useAuthStore } from "../store/auth.store";

export const hasPermission = (permissionId: string) => {
  const user = useAuthStore.getState().user;

  if (!user) {
    return false;
  }

  return (
    user.permissions?.some((permission) => permission.id === permissionId) ??
    false
  );
};

export const hasRole = (roleId: string) => {
  const user = useAuthStore.getState().user;

  return user?.role_id === roleId;
};
