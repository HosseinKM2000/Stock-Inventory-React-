import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { industryKeys } from "../query/query-keys";
import {
  createIndustry,
  deleteIndustry,
  getIndustries,
  setIndustry,
  updateIndustry,
} from "../api/industry.api";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/api-error";
import { authKeys } from "@/features/auth/query/query-keys";
import type { User } from "@/features/auth/types";
import { useNavigate } from "@tanstack/react-router";
import { syncMetadataStorage } from "@/shared/lib/infrastructure/storage/sync-metadata-storage";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { accessState } from "@/shared/access/access-state";

export function useIndustries() {
  return useQuery({
    queryKey: industryKeys.all,
    queryFn: getIndustries,

    staleTime: Infinity,

    gcTime: Infinity,
  });
}

export function useCreateIndustry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createIndustry,

    onSuccess() {
      toast.success("اطلاعات با موفقیت ثبت شد!");
      qc.invalidateQueries({
        queryKey: industryKeys.all,
      });
    },
  });
}

export function useUpdateIndustry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: updateIndustry,

    onSuccess() {
      qc.invalidateQueries({
        queryKey: industryKeys.all,
      });
    },
  });
}

export function useDeleteIndustry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteIndustry,

    onSuccess() {
      toast.success("حوزه کاری حذف شد.");
      qc.invalidateQueries({
        queryKey: industryKeys.all,
      });
    },
    onError(error) {
      toast.error(
        error instanceof ApiError && error.message === "INDUSTRY_HAS_CATALOG_PRODUCTS"
          ? "حذف این حوزه کاری امکان‌پذیر نیست؛ محصولات کاتالوگ به آن وابسته هستند."
          : "حذف حوزه کاری ناموفق بود.",
      );
    },
  });
}

export function useSetIndustry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (industryId: number) => {
      await syncService.sync();
      if ((await queueService.count()) > 0) {
        throw new Error(
          "پیش از تغییر حوزه کاری، تغییرات محلی در انتظار همگام‌سازی را برطرف کنید.",
        );
      }
      return setIndustry(industryId);
    },
    onSuccess: async (data: User) => {
      accessState.saveUser(data);
      await syncMetadataStorage.set("product-sync-cursor", 0);

      await syncMetadataStorage.set("product-sync-initialized", 0);

      await syncService.sync();

      await queryClient.setQueryData(authKeys.me, (old: User) => {
        if (!old) return old;

        return {
          ...old,
          industry_id: data?.industry_id,
        };
      });
      toast.success("حوزه کاری ثبت شد.");
      navigate({
        to: "/dashboard",
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "ثبت حوزه کاری ناموفق بود.",
      );
    },
  });
}
