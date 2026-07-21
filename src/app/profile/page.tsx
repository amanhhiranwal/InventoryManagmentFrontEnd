"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import api from "@/lib/axios";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiBriefcase,
  FiMapPin,
  FiShield,
  FiLock,
  FiCheckCircle,
  FiCamera
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const { addToast } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [rolesList, setRolesList] = useState<string[]>([]);
  
  // Security Mock States
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/v1/profile/");
      const profile = data.data;
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setPhone(profile.phone_number || "");
      setEmployeeId(profile.employee_id || "");
      setAvatarUrl(profile.avatar_url || null);
      setRolesList(profile.roles || []);
    } catch (err) {
      console.error(err);
      addToast("Failed to fetch user profile details.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      addToast("First and Last name are required.", "warning");
      return;
    }

    try {
      await api.put("/api/v1/profile/", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim() || null
      });

      // Update local auth store so layout updates immediately
      if (user) {
        useAuthStore.setState({
          user: {
            ...user,
            first_name: firstName.trim(),
            last_name: lastName.trim()
          }
        });
      }

      addToast("Profile details updated successfully!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to update profile details.", "error");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Only image files are allowed.", "warning");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await api.post("/api/v1/profile/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      setAvatarUrl(data.avatar_url);
      addToast("Profile avatar uploaded successfully!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to upload profile avatar.", "error");
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      addToast("Please fill all password fields.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("New password and confirmation do not match.", "warning");
      return;
    }
    addToast("Security credentials updated successfully! (Mock Action)", "success");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // User initials for cover avatar
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "SG";

  const mockPermissions = user?.is_super_admin 
    ? ["*", "company.create", "company.read", "company.update", "company.delete", "location.create", "location.read", "location.update", "location.delete", "user.create", "user.read", "user.update", "user.delete", "role.create", "role.read", "role.update", "role.delete", "inventory.create", "inventory.read", "inventory.update", "inventory.delete"]
    : ["customer.read", "customer.create", "lead.read", "lead.create", "lead.update", "opportunity.read", "opportunity.update"];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-slate-400">
        <CgSpinner className="animate-spin text-4xl text-primary" />
        <span className="text-xs font-semibold">Compiling user identity profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      
      {/* Cover Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 p-6 sm:p-10 text-white shadow-lg overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-[#e07a22]/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 translate-y-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl" />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile Avatar"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-slate-700 object-cover shadow-inner"
                onError={() => setAvatarUrl(null)} // fallback if load fails
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-3xl font-extrabold text-[#e07a22] shadow-inner select-none">
                {initials}
              </div>
            )}
            <label className="absolute bottom-1 right-1 p-2 bg-[#e07a22] hover:bg-[#b45309] text-white rounded-lg cursor-pointer transition-all shadow-md group-hover:scale-105">
              <FiCamera className="text-sm" />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </label>
          </div>

          <div className="text-center sm:text-left space-y-1.5">
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <h2 className="text-2xl font-serif font-black tracking-wide">
                {firstName} {lastName}
              </h2>
              <span className="bg-[#e07a22]/20 border border-[#e07a22]/30 text-[#e07a22] text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                {user?.is_super_admin ? "Super Administrator" : "Sales Representative"}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Email: <span className="font-semibold text-slate-355">{user?.email}</span> | Employee ID: <span className="font-semibold text-slate-355">{employeeId || "SG-8899"}</span>
            </p>
            <div className="flex items-center gap-2 justify-center sm:justify-start text-emerald-400 text-xs font-bold pt-1">
              <FiCheckCircle className="text-sm shrink-0" />
              <span>Identity Verified Account</span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Body Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Summary Card */}
        <div className="lg:col-span-4 space-y-6">
          <Card title="Workspace Profile">
            <div className="space-y-4 pt-3.5 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-[#0d2336]/30">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5"><FiBriefcase /> Company</span>
                <span className="font-bold text-slate-800 dark:text-white">Synergy Global Inc.</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-[#0d2336]/30">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5"><FiMapPin /> Base HQ</span>
                <span className="font-bold text-slate-800 dark:text-white">Gurgaon (Haryana, IN)</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-[#0d2336]/30">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5"><FiShield /> Role Level</span>
                <span className="font-bold text-[#e07a22]">{user?.is_super_admin ? "L10 - Admin" : "L4 - Executive"}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5"><FiUser /> Account Status</span>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                  Active
                </span>
              </div>
            </div>
          </Card>

          <Card title="Active Access Scope">
            <div className="space-y-3 pt-3.5">
              <p className="text-[10px] text-slate-400 leading-normal">
                These authorization strings define which actions your identity is permitted to execute across Synergy modules.
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto pr-1">
                {mockPermissions.map((perm) => (
                  <span
                    key={perm}
                    className="inline-flex items-center bg-indigo-500/10 text-indigo-700 dark:text-indigo-35 border border-indigo-500/20 text-[9px] px-2.5 py-0.5 rounded font-mono font-semibold"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side: Details & Security tab boxes */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Edit profile details */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-[#0d2336]/40 pb-3 flex items-center gap-2">
              <FiUser className="text-[#e07a22]" /> Personal Account Details
            </h3>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Email Identifier (Read Only)
                  </label>
                  <div className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 font-mono select-none">
                    {user?.email}
                  </div>
                </div>
                <Input
                  label="Contact Phone"
                  placeholder="+91 XXXXX XXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>

          {/* Section 2: Security credentials update */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-[#0d2336]/40 pb-3 flex items-center gap-2">
              <FiLock className="text-[#e07a22]" /> Access Credentials & Security
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Current Password"
                  type="password"
                  placeholder="••••••••"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <Input
                  label="New Password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit">
                  Change Password
                </Button>
              </div>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
}
