"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

import { loginApi, meApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";

export default function LoginForm() {
  const router = useRouter();

  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const login = await loginApi(email, password);

      Cookies.set("token", login.access_token);

      console.log(login);

      const me = await meApi(login.access_token);

      console.log(me)

      setAuth(login.access_token, {
        id: login.user.id,
        first_name: login.user.first_name,
        last_name: login.user.last_name,
        email: login.user.email,
        exp: me.data.exp,
      });

      router.replace("/dashboard");
    } catch (err) {
      console.log(err);

      alert("Invalid Credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="
      w-full
      space-y-5
      rounded-xl
      p-8
    "
    >
      <div>
        <h1 className="text-3xl font-bold text-white">Welcome Back</h1>

        <p className="mt-2 text-sm text-gray-400">Sign in to continue</p>
      </div>

      <div>
        <label
          className="
          mb-2
          block
          text-sm
          font-medium
          text-white
        "
        >
          Email
        </label>

        <input
          type="email"

          className="
          w-full
          rounded-lg
          border
          border-white/20
          bg-white/10
          px-4
          py-3
          text-white
          placeholder:text-gray-400
          outline-none
          backdrop-blur-sm
          transition
          focus:border-white
          focus:ring-2
          focus:ring-white/30
        "

          placeholder="Enter your email"

          value={email}

          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label
          className="
          mb-2
          block
          text-sm
          font-medium
          text-white
        "
        >
          Password
        </label>

        <input
          type="password"

          className="
          w-full
          rounded-lg
          border
          border-white/20
          bg-white/10
          px-4
          py-3
          text-white
          placeholder:text-gray-400
          outline-none
          backdrop-blur-sm
          transition
          focus:border-white
          focus:ring-2
          focus:ring-white/30
        "

          placeholder="Enter your password"

          value={password}

          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button
        disabled={loading}

        className="
        w-full
        rounded-lg
        bg-white
        px-4
        py-3
        font-semibold
        text-black
        transition
        hover:bg-gray-200
        disabled:cursor-not-allowed
        disabled:opacity-50
      "
      >
        {loading ? "Signing In..." : "Login"}
      </button>
    </form>
  );
}
