import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@hh/shared";
import { api, gameStateSchema } from "../lib/api-schema";

export function useGameState(avoidNutTypes: string[] = []) {
  const avoidKey = avoidNutTypes.join(",");
  return useQuery({
    queryKey: [api.game.new.path, avoidKey],
    queryFn: async () => {
      const path = avoidKey
        ? `${api.game.new.path}?avoidNutTypes=${encodeURIComponent(avoidKey)}`
        : api.game.new.path;
      const data = await apiFetch(path);
      return gameStateSchema.parse(data);
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export function useNewGame() {
  const queryClient = useQueryClient();
  return (avoidNutTypes: string[] = []) => {
    const avoidKey = avoidNutTypes.join(",");
    queryClient.invalidateQueries({ queryKey: [api.game.new.path, avoidKey] });
  };
}
