import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { clearToken, setToken } from "@/shared/api/token-store";
import {
  getMe,
  login,
  register,
  updatePassword,
  updateProfile,
} from "../api/auth.api";
import type { AuthResponse } from "../types";
import { toast } from "sonner";

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
    onSuccess: (data: AuthResponse) => {
      setToken(data.access_token);
      queryClient.setQueryData(authKeys.me, data.user);
      navigate({ to: "/" });
      toast.success(`با موفقیت وارد شدید`);
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: register,
    onSuccess: (data: AuthResponse) => {
      setToken(data.access_token);
      queryClient.setQueryData(authKeys.me, data.user);
      navigate({ to: "/" });
      toast.success(`ثبت با موفقیت انجام شد`);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: updatePassword,
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return () => {
    clearToken();
    queryClient.clear();
    navigate({ to: "/auth/login" });
  };
}
