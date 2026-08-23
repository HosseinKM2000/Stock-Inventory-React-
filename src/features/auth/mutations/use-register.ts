import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { clearToken, setToken } from "@/shared/api/token-store";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { syncMetadataStorage } from "@/shared/lib/infrastructure/storage/sync-metadata-storage";

import {
  getMe,
  login,
  logout,
  register,
  updatePassword,
  updateProfile,
} from "../api/auth.api";

import type { AuthResponse } from "../types";
import { authKeys } from "../query/query-keys";
import { accessState } from "@/shared/access/access-state";



export function useMe(enabled = true) {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: getMe,
    enabled,
    retry: false,
  });
}

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,

    onSuccess: async (data: AuthResponse) => {
      setToken(data.access_token);
      accessState.saveUser(data.user);

      await syncMetadataStorage.set("product-sync-cursor", 0);

      await syncMetadataStorage.set("product-sync-initialized", 0);

      await syncService.sync();

      queryClient.setQueryData(authKeys.me, data.user);

      await queryClient.invalidateQueries({
        queryKey: authKeys.me,
      });

      toast.success("با موفقیت وارد شدید");

      navigate({
        to: "/dashboard",
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
      accessState.saveUser(data.user);

      await syncMetadataStorage.set("product-sync-cursor", 0);

      await syncMetadataStorage.set("product-sync-initialized", 0);

      await syncService.sync();

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
      accessState.saveUser(user);
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
      accessState.clear();
      queryClient.clear();

      navigate({
        to: "/auth/login",
      });
    }
  };
}
