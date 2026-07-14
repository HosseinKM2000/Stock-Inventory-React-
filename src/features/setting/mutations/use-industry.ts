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
import { authKeys } from "@/features/auth/query/query-keys";
import type { User } from "@/features/auth/types";
import { useNavigate } from "@tanstack/react-router";

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
      qc.invalidateQueries({
        queryKey: industryKeys.all,
      });
    },
  });
}

export function useSetIndustry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setIndustry,
    onSuccess: async (data: User) => {
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
  });
}
