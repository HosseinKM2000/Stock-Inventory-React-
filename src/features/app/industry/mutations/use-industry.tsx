import { useMutation } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { setIndustry } from "../api/industry.api";

export function useIndustry() {
  return useMutation({
    mutationFn: setIndustry,

    onSuccess: async () => {
      Navigate({
        to: "/",
      });
    },
  });
}
