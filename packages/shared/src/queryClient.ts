import { QueryClient } from "@tanstack/react-query";

/**
 * 모든 앱이 공유하는 React Query 클라이언트 팩토리.
 * 개별 앱은 이 함수를 호출해 자체 인스턴스를 생성한다.
 *
 * 기본 정책:
 *  - staleTime 30초 (게임 상태 데이터는 자주 갱신)
 *  - retry 1회 (서버 일시 장애 외에는 재시도 의미 없음)
 *  - refetchOnWindowFocus 끔 (게임 도중 산만함 방지)
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
