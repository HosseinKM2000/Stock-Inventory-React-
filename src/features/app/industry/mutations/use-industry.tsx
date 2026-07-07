import { useMutation } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { setIndustry } from "../api/industry.api";

export function useIndustry() {
  return useMutation({
    mutationFn: setIndustry,

    onSuccess: async () => {
      toast.success("با موفقیت وارد شدید");

      Navigate({
        to: "/",
      });
    },
  });
}
