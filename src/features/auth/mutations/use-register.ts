import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { clearToken, setToken } from "@/shared/api/token-store";

import {
  getMe,
  login,
  logout,
  register,
  updatePassword,
  updateProfile,
} from "../api/auth.api";

import type { AuthResponse } from "../types";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export function useMe(enabled = true) {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: getMe,
    enabled,
  });
}

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,

    onSuccess: async (data: AuthResponse) => {
      setToken(data.access_token);

      queryClient.setQueryData(authKeys.me, data.user);

      await queryClient.invalidateQueries({
        queryKey: authKeys.me,
      });

      toast.success("با موفقیت وارد شدید");

      navigate({
        to: "/",
      });
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: register,

    onSuccess: async (data: AuthResponse) => {
      setToken(data.access_token);

      queryClient.setQueryData(authKeys.me, data.user);

      await queryClient.invalidateQueries({
        queryKey: authKeys.me,
      });

      toast.success("ثبت نام با موفقیت انجام شد");

      navigate({
        to: "/industry",
      });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,

    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);

      toast.success("اطلاعات بروزرسانی شد");
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: updatePassword,

    onSuccess: () => {
      toast.success("رمز عبور تغییر کرد");
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return async () => {
    try {
      await logout();
    } finally {
      clearToken();
      queryClient.clear();

      navigate({
        to: "/auth/login",
      });
    }
  };
}