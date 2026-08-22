export interface LoginResponse {
  success: boolean;
  access_token: string;
  token_type: string;

  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    is_super_admin: boolean;
  };
}

export interface MeResponse {
  success: boolean;

  data: {
    user_id: string;
    email: string;
    role_id: string;
    exp: number;
    permissions: Permission[];
  };
}

export interface Permission {
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;

  first_name: string;

  last_name: string;

  email: string;

  is_super_admin: boolean;

  exp: number;

  role_id?: string;

  avatar_url?: string | null;

  permissions?: Permission[];
}
