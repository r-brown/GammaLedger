import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";

export function useFeatureFlag(featureName: string): {
  enabled: boolean;
  limitValue: number | null;
  isLoading: boolean;
} {
  const query = useQuery({ queryKey: ["features"], queryFn: api.features });
  const feature = query.data?.data.find((row) => row.featureName === featureName);
  return {
    enabled: Boolean(feature?.enabled),
    limitValue: feature?.limitValue ?? null,
    isLoading: query.isLoading,
  };
}

