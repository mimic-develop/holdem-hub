import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@hh/shared";
import { api, gameStateSchema } from "../lib/api-schema";

const _env = (import.meta as unknown as { env?: { VITE_MIMIC_NUT_ENGINE_URL?: string } }).env;
const ENGINE = (_env?.VITE_MIMIC_NUT_ENGINE_URL ?? "http://localhost:3010").replace(/\/$/, "");

export function useGameState(avoidNutTypes: string[] = []) {
  const avoidKey = avoidNutTypes.join(",");
  return useQuery({
    queryKey: [api.game.new.path, avoidKey],
    queryFn: async () => {
      const path = avoidKey
        ? `${ENGINE}/game/new?avoidNutTypes=${encodeURIComponent(avoidKey)}`
        : `${ENGINE}/game/new`;
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
