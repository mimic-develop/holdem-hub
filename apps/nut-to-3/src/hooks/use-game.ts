import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-schema";

export function useGameState(avoidNutTypes: string[] = []) {
  const avoidKey = avoidNutTypes.join(",");
  return useQuery({
    queryKey: [api.game.new.path, avoidKey],
    queryFn: async () => {
      const url = avoidKey
        ? `${api.game.new.path}?avoidNutTypes=${encodeURIComponent(avoidKey)}`
        : api.game.new.path;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch new game state");
      const data = await res.json();
      return api.game.new.responses[200].parse(data);
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
